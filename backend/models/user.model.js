const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { PASSWORD_MIN, PASSWORD_MAX } = require('../config/constants');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        // Deliberately permissive (the route validates with express-validator's isEmail):
        // allows +tags, any TLD length (.info, .online …) and unusual-but-valid local parts
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Invalid email format']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: PASSWORD_MIN,
        maxlength: PASSWORD_MAX,
        select: false   // never returned in queries by default
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student'
    },
    branch: {
        type: String,
        required: function () { return this.role === 'student'; }
    },
    // Defaults to true so accounts that existed before verification was added (and the seeded ones)
    // keep working; public registration explicitly creates students as false
    emailVerified: {
        type: Boolean,
        default: true
    },
    // Only the SHA-256 hash of each e-mailed token is stored (see utils/tokens.js)
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Login tokens issued before this moment are rejected (set when the password is reset)
    passwordChangedAt: { type: Date }
}, { timestamps: true });

// Hash password before saving — only when it's been modified
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
