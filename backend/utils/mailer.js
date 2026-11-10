// Sends the account e-mails (verify address, reset password) through SMTP — Gmail by default.
// Without SMTP_USER / SMTP_PASS the message is printed to the server console instead, so the
// flow can be tried on a laptop with no mail account; in production that is refused, because
// anyone who can read the logs could then use the links.
const nodemailer = require('nodemailer');
const { EMAIL_VERIFICATION_HOURS, PASSWORD_RESET_MINUTES } = require('../config/constants');

const APP_NAME = 'Placement Management System';
const BRAND_COLOR = '#bd0745';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

function smtpConfigured() {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Where the links in the e-mails point. Set APP_URL when deployed; locally it is this server.
function appUrl() {
    return (process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, '');
}

const verificationLink = (token) => `${appUrl()}/verify-email.html?token=${token}`;
const resetLink = (token) => `${appUrl()}/reset-password.html?token=${token}`;

let transporter;
function getTransporter() {
    if (!transporter) {
        const port = Number(process.env.SMTP_PORT) || 465;
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port,
            secure: port === 465,
            // Google shows app passwords in groups of four with spaces; they are not part of the password
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s+/g, '') },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000
        });
    }
    return transporter;
}

async function sendMail({ to, subject, text, html }) {
    if (!smtpConfigured()) {
        if (process.env.NODE_ENV === 'production') throw new Error('SMTP_USER and SMTP_PASS are not set');
        console.log(`\n--- E-mail not sent (SMTP_USER / SMTP_PASS not set) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`);
        return;
    }
    await getTransporter().sendMail({
        from: process.env.MAIL_FROM || `"${APP_NAME}" <${process.env.SMTP_USER}>`,
        to, subject, text, html
    });
}

// One layout for every message: greeting, what to do, a button, the plain link and a closing note
function compose({ name, intro, buttonLabel, link, note }) {
    const text = `Hi ${name},\n\n${intro}\n\n${link}\n\n${note}\n\n${APP_NAME}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333;line-height:1.5">
<h2 style="color:${BRAND_COLOR};margin:0 0 16px">${APP_NAME}</h2>
<p>Hi ${escapeHtml(name)},</p>
<p>${escapeHtml(intro)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:${BRAND_COLOR};color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(buttonLabel)}</a></p>
<p style="font-size:13px;color:#666">If the button does not work, copy this link into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="font-size:13px;color:#666">${escapeHtml(note)}</p>
</div>`;
    return { text, html };
}

function sendVerificationEmail(user, token) {
    const link = verificationLink(token);
    return sendMail({
        to: user.email,
        subject: `Verify your email — ${APP_NAME}`,
        ...compose({
            name: user.name,
            intro: 'Welcome! Please confirm your email address to activate your account.',
            buttonLabel: 'Verify my email',
            link,
            note: `This link works once and expires in ${EMAIL_VERIFICATION_HOURS} hours. If you did not create an account, you can ignore this email.`
        })
    });
}

function sendPasswordResetEmail(user, token) {
    const link = resetLink(token);
    return sendMail({
        to: user.email,
        subject: `Reset your password — ${APP_NAME}`,
        ...compose({
            name: user.name,
            intro: 'We received a request to reset your password. Use the button below to choose a new one.',
            buttonLabel: 'Reset my password',
            link,
            note: `This link works once and expires in ${PASSWORD_RESET_MINUTES} minutes. If you did not ask for this, ignore this email and your password stays the same.`
        })
    });
}

module.exports = { smtpConfigured, appUrl, verificationLink, resetLink, sendMail, sendVerificationEmail, sendPasswordResetEmail };
