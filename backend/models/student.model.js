const mongoose = require('mongoose');

const PLACEMENT_STATUSES = ['Unplaced', 'Under Review', 'Interview Scheduled', 'Placed'];
const RESUME_STATUSES = ['pending', 'approved', 'rejected'];
const MAX_NOTIFICATIONS = 100;

const studentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true   // one student profile per user account
    },

    // Free text, edited in textareas on the profile page
    skills:    { type: String, default: '' },
    education: { type: String, default: '' },
    projects:  { type: String, default: '' },

    status: {
        type: String,
        enum: PLACEMENT_STATUSES,
        default: 'Unplaced'
    },

    // The PDF itself lives in MongoDB GridFS (bucket "resumes"); this holds its metadata
    resume: {
        name:       { type: String, default: null },
        fileId:     { type: mongoose.Schema.Types.ObjectId, default: null },
        uploadedAt: { type: Date, default: null },
        status:     { type: String, enum: RESUME_STATUSES, default: 'pending' }
    },

    notifications: [{
        message:   { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        read:      { type: Boolean, default: false }
    }],

    // Events the student added to their personal calendar (copied from the shared Event)
    events: [{
        eventId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
        title:       String,
        date:        String,
        description: String,
        addedAt:     { type: Date, default: Date.now }
    }],

    // Placement-status changes, oldest first
    statusHistory: [{
        status:    String,
        message:   String,
        timestamp: { type: Date, default: Date.now }
    }]

}, { timestamps: true });

// Add a notification and keep only the most recent MAX_NOTIFICATIONS
studentSchema.methods.notify = function (message) {
    this.notifications.push({ message });
    if (this.notifications.length > MAX_NOTIFICATIONS) {
        this.notifications = this.notifications.slice(-MAX_NOTIFICATIONS);
    }
};

studentSchema.statics.MAX_NOTIFICATIONS = MAX_NOTIFICATIONS;

module.exports = mongoose.model('Student', studentSchema);
