// Single source of truth for values used by validation and schemas.
// The frontend reads these from GET /api/public/meta, so this file is the only place to change them.
module.exports = {
    BRANCHES: ['MCA', 'MBA'],
    JOB_TYPES: ['Full Time', 'Part Time', 'Internship'],
    // bcrypt only uses the first 72 bytes of a password
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 72,
    // How long the e-mailed links work, and the pause before another one may be sent to the same account
    EMAIL_VERIFICATION_HOURS: 24,
    PASSWORD_RESET_MINUTES: 60,
    MAIL_COOLDOWN_SECONDS: 60
};
