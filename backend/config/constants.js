// Single source of truth for values used by validation and schemas.
// The frontend reads these from GET /api/public/meta, so this file is the only place to change them.
module.exports = {
    BRANCHES: ['MCA', 'MBA'],
    JOB_TYPES: ['Full Time', 'Part Time', 'Internship'],
    // bcrypt only uses the first 72 bytes of a password
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 72
};
