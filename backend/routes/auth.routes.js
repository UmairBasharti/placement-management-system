const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { BRANCHES } = require('../config/constants');

// Helper — sign JWT
function signToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '24h'
    });
}

// POST /api/auth/register
router.post('/register', [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

        // Create auth user (always as student)
        const user = await User.create({ name, email, password, role, branch });

        // Create Student profile immediately after registration; if that fails, undo the user so we
        // never leave an account that can log in but has no profile
        try {
            await Student.create({ user: user._id });
        } catch (err) {
            await User.deleteOne({ _id: user._id });
            throw err;
        }

        // Don't return JWT — user must explicitly log in
        res.status(201).json({
            success: true,
            message: 'Registration successful! Please log in.'
        });

    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', [
    body('email').trim().toLowerCase().isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
], async (req, res, next) => {
    try {

        const { email, password } = req.body;

        // select('+password') because password has select:false on schema
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
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
