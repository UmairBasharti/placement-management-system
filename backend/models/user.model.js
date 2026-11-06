const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
        minlength: 6,
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
    }
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
