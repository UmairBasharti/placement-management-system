const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },

    // Denormalized fields for quick display without joins
    studentName:  { type: String, required: true },
    studentEmail: { type: String, required: true },
    course:       { type: String, default: '' },
    skills:       { type: String, default: '' },
    resumeName:   { type: String, default: '' },

    status: {
        type: String,
        enum: ['Pending', 'Accepted', 'Rejected'],
        default: 'Pending'
    },

    appliedDate: {
        type: Date,
        default: Date.now
    }

}, { timestamps: true });

// Prevent a student from applying to the same company twice
applicationSchema.index({ student: 1, company: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
