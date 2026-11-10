const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { createToken, hashToken, TOKEN_PATTERN } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');
const {
    BRANCHES, PASSWORD_MIN, PASSWORD_MAX,
    EMAIL_VERIFICATION_HOURS, PASSWORD_RESET_MINUTES, MAIL_COOLDOWN_SECONDS
} = require('../config/constants');

// Hash compared against when the e-mail is unknown (see the login route)
const UNKNOWN_USER_HASH = bcrypt.hashSync('not-a-real-password', 10);

const EMAIL_VERIFICATION_MS = EMAIL_VERIFICATION_HOURS * 60 * 60 * 1000;
const PASSWORD_RESET_MS = PASSWORD_RESET_MINUTES * 60 * 1000;

// Helper — sign JWT
function signToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: process.env.JWT_EXPIRE || '24h'
    });
}

// Helpers — a fresh one-time token: `token` goes into the e-mailed link, `fields` (its hash and
// expiry) are what gets stored on the user
function newVerification() {
    const { token, hash } = createToken();
    return { token, fields: { emailVerificationToken: hash, emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_MS) } };
}

function newPasswordReset() {
    const { token, hash } = createToken();
    return { token, fields: { passwordResetToken: hash, passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_MS) } };
}

// A link was e-mailed to this account less than MAIL_COOLDOWN_SECONDS ago (so nobody can use the
// forms to flood someone's inbox). The send time is the expiry minus the lifetime.
function sentRecently(expires, lifetimeMs) {
    return Boolean(expires) && expires.getTime() - lifetimeMs > Date.now() - MAIL_COOLDOWN_SECONDS * 1000;
}

// The forgot-password and resend forms always answer the same way, so they cannot be used to find out
// which e-mails are registered. The e-mail is sent without waiting, so the response time does not give it away either.
function sendInBackground(sending) {
    sending.catch((err) => console.error('E-mail could not be sent:', err.message));
}

const emailField = body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required');
const tokenField = body('token').isString().matches(TOKEN_PATTERN).withMessage('This link is invalid or has expired.');

// POST /api/auth/register
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    body('password').isString().isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
        .withMessage(`Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`),
    body('branch').isIn(BRANCHES).withMessage(`Branch must be one of: ${BRANCHES.join(', ')}`),
    validate
], async (req, res, next) => {
    try {

        const { name, email, password, branch } = req.body;

        // Public registration always creates a student — never an admin
        const role = 'student';

        // Check duplicate email
        if (await User.findOne({ email })) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Create auth user (always as student). It cannot log in until the e-mailed link is opened.
        const { token, fields } = newVerification();
        const user = await User.create({ name, email, password, role, branch, emailVerified: false, ...fields });

        // Create Student profile immediately after registration; if that fails, undo the user so we
        // never leave an account that can log in but has no profile
        try {
            await Student.create({ user: user._id });
        } catch (err) {
            await User.deleteOne({ _id: user._id });
            throw err;
        }

        // The account exists either way; if the e-mail fails the user can ask for another one
        let emailSent = true;
        try {
            await sendVerificationEmail(user, token);
        } catch (err) {
            emailSent = false;
            console.error('Verification e-mail could not be sent:', err.message);
        }

        // Don't return JWT — user must verify the e-mail and then explicitly log in
        res.status(201).json({
            success: true,
            emailSent,
            message: emailSent
                ? 'Registration successful! We sent a verification link to your email — open it, then log in.'
                : 'Account created, but the verification email could not be sent. Use "Resend verification email" on the login page.'
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', [
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    body('password').isString().notEmpty().withMessage('Password is required'),
    validate
], async (req, res, next) => {
    try {

        const { email, password } = req.body;

        // select('+password') because password has select:false on schema
        const user = await User.findOne({ email }).select('+password');
        // An unknown e-mail still pays for one bcrypt comparison, so the response time does not reveal which e-mails exist
        const passwordOk = user ? await user.matchPassword(password) : (await bcrypt.compare(password, UNKNOWN_USER_HASH), false);
        if (!passwordOk) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        // Checked after the password, so only someone who knows it can learn the account is unverified
        if (!user.emailVerified) {
            return res.status(403).json({
                success: false,
                code: 'EMAIL_NOT_VERIFIED',
                message: 'Please verify your email before logging in. Open the link we sent you, or ask for a new one.'
            });
        }

        const token = signToken(user._id);

        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/auth/verify-email — the link in the registration e-mail lands on a page that posts its token here
router.post('/verify-email', [tokenField, validate], async (req, res, next) => {
    try {
        // One atomic step, so a link works only once even if it is opened twice at the same moment
        const user = await User.findOneAndUpdate(
            { emailVerificationToken: hashToken(req.body.token), emailVerificationExpires: { $gt: new Date() } },
            { $set: { emailVerified: true }, $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 } }
        );
        if (!user) {
            return res.status(400).json({ success: false, message: 'This link is invalid or has expired.' });
        }
        res.json({ success: true, message: 'Email verified. You can log in now.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/resend-verification — a new link for an account that has not verified yet
router.post('/resend-verification', [emailField, validate], async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email }).select('+emailVerificationExpires');
        if (user && !user.emailVerified && !sentRecently(user.emailVerificationExpires, EMAIL_VERIFICATION_MS)) {
            const { token, fields } = newVerification();
            Object.assign(user, fields);
            await user.save();
            sendInBackground(sendVerificationEmail(user, token));
        }
        res.json({ success: true, message: 'If that account is waiting for verification, a new link is on its way. Check your spam folder too.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/forgot-password — e-mails a reset link
router.post('/forgot-password', [emailField, validate], async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email }).select('+passwordResetExpires');
        if (user && !sentRecently(user.passwordResetExpires, PASSWORD_RESET_MS)) {
            const { token, fields } = newPasswordReset();
            Object.assign(user, fields);
            await user.save();
            sendInBackground(sendPasswordResetEmail(user, token));
        }
        res.json({ success: true, message: 'If an account with that email exists, a password reset link is on its way. Check your spam folder too.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/reset-password — sets a new password from the e-mailed link
router.post('/reset-password', [
    tokenField,
    body('password').isString().isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
        .withMessage(`Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters`),
    validate
], async (req, res, next) => {
    try {
        // Using up the token is one atomic step, so the link works only once
        const user = await User.findOneAndUpdate(
            { passwordResetToken: hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } },
            { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
        );
        if (!user) {
            return res.status(400).json({ success: false, message: 'This link is invalid or has expired.' });
        }

        user.password = req.body.password;        // hashed by the model before saving
        user.passwordChangedAt = new Date();      // ends every login started before now (see protect)
        user.emailVerified = true;                // the link only reached the owner of this inbox
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        res.json({ success: true, message: 'Password updated. You can log in now.' });
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me — verify token and return current user
router.get('/me', protect, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            branch: req.user.branch
        }
    });
});

module.exports = router;
