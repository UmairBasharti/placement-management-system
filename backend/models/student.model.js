const mongoose = require('mongoose');

// Status values match exactly what the frontend renders
const PLACEMENT_STATUSES = ['Unplaced', 'Under Review', 'Interview Scheduled', 'Placed'];

const studentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true   // one student profile per user account
    },

    // Profile fields — stored as plain text to match frontend's textarea inputs
    skills:    { type: String, default: '' },
    education: { type: String, default: '' },
    projects:  { type: String, default: '' },

    status: {
        type: String,
        enum: PLACEMENT_STATUSES,
        default: 'Unplaced'
    },

    // Resume stored as metadata; actual file lives in backend/uploads/
    resume: {
        name:       { type: String, default: null },
        path:       { type: String, default: null },   // relative path for serving: /uploads/filename.pdf
        uploadedAt: { type: Date,   default: null },
        approved:   { type: Boolean, default: false }
    },

    // Notifications pushed by admin actions
    notifications: [{
        message:   { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        read:      { type: Boolean, default: false }
    }],

    // Events the student added to their personal calendar
    events: [{
        title:       String,
        date:        String,   // ISO string kept as-is from frontend
        description: String,
        addedAt:     { type: Date, default: Date.now }
    }],

    // History of placement status changes
    statusHistory: [{
        status:    String,
        message:   String,
        timestamp: { type: Date, default: Date.now }
    }]

}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
