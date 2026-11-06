const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Event title is required'],
        trim: true,
        maxlength: [120, 'Event title can be at most 120 characters']
    },
    // Local date-time exactly as chosen in the <input type="datetime-local"> (e.g. 2026-11-20T10:00).
    // Kept as a string on purpose: there is one campus time zone, and a string avoids server-timezone shifts.
    date: {
        type: String,
        required: [true, 'Event date is required'],
        match: [/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Event date must look like 2026-11-20T10:00']
    },
    description: {
        type: String,
        default: '',
        maxlength: [1000, 'Event description can be at most 1000 characters']
    }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
