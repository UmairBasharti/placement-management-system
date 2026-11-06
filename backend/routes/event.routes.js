const express = require('express');
const router = express.Router();
const Event = require('../models/event.model');
const Student = require('../models/student.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');

// GET /api/events — all authenticated users can see events
router.get('/', protect, async (req, res) => {
    try {
        const events = await Event.find().sort({ date: 1 });
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/events — admin only: create event + notify all students
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { title, date, description } = req.body;
        if (!title || !date) {
            return res.status(400).json({ success: false, message: 'Title and date are required' });
        }

        const event = await Event.create({ title, date, description });

        // Push notification to every student
        const notification = { message: `New event scheduled: ${title}`, timestamp: new Date() };
        await Student.updateMany({}, { $push: { notifications: notification } });

        await Activity.create({
            type: 'event',
            title: `New event created: ${title}`
        });

        res.status(201).json({ success: true, data: event, message: 'Event created' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/events/:id — admin only: update event + notify students
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { title, date, description } = req.body;

        const event = await Event.findByIdAndUpdate(
            req.params.id,
            { title, date, description },
            { new: true, runValidators: true }
        );

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Notify all students about the update
        const notification = { message: `Event updated: ${event.title}`, timestamp: new Date() };
        await Student.updateMany({}, { $push: { notifications: notification } });

        await Activity.create({
            type: 'event',
            title: `Event updated: ${event.title}`
        });

        res.json({ success: true, data: event, message: 'Event updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/events/:id — admin only: delete event + notify students
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Notify all students about cancellation
        const notification = { message: `Event cancelled: ${event.title}`, timestamp: new Date() };
        await Student.updateMany({}, { $push: { notifications: notification } });

        await Activity.create({
            type: 'event',
            title: `Event deleted: ${event.title}`
        });

        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
