const express = require('express');
const Event = require('../models/event.model');
const Student = require('../models/student.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Every student gets the message; each student keeps only their most recent notifications
function notifyAllStudents(message) {
    return Student.updateMany({}, {
        $push: {
            notifications: {
                $each: [{ message, timestamp: new Date(), read: false }],
                $slice: -Student.MAX_NOTIFICATIONS
            }
        }
    });
}

function pickEventFields(body) {
    const { title, date, description } = body;
    return { title, date, description };
}

// GET /api/events — all events, soonest first
router.get('/', protect, async (req, res, next) => {
    try {
        res.json({ success: true, data: await Event.find().sort({ date: 1 }) });
    } catch (error) {
        next(error);
    }
});

// POST /api/events — admin: create an event and notify all students
router.post('/', protect, authorize('admin'), async (req, res, next) => {
    try {
        const event = await Event.create(pickEventFields(req.body));

        await notifyAllStudents(`New event scheduled: ${event.title}`);
        await Activity.create({ type: 'event', title: `New event created: ${event.title}` });

        res.status(201).json({ success: true, data: event, message: 'Event created' });
    } catch (error) {
        next(error);
    }
});

// PUT /api/events/:id — admin: update an event, refresh students' calendar copies, notify students
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const event = await Event.findByIdAndUpdate(req.params.id, pickEventFields(req.body), { new: true, runValidators: true });
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        await Student.updateMany(
            { 'events.eventId': event._id },
            { $set: { 'events.$[e].title': event.title, 'events.$[e].date': event.date, 'events.$[e].description': event.description } },
            { arrayFilters: [{ 'e.eventId': event._id }] }
        );
        await notifyAllStudents(`Event updated: ${event.title}`);
        await Activity.create({ type: 'event', title: `Event updated: ${event.title}` });

        res.json({ success: true, data: event, message: 'Event updated' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/events/:id — admin: delete an event, drop it from students' calendars, notify students
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        await Student.updateMany({}, { $pull: { events: { eventId: event._id } } });
        await notifyAllStudents(`Event cancelled: ${event.title}`);
        await Activity.create({ type: 'event', title: `Event deleted: ${event.title}` });

        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
