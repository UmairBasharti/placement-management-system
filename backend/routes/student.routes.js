const express = require('express');
const router = express.Router();
const path = require('path');
const Student = require('../models/student.model');
const User = require('../models/user.model');
const Application = require('../models/application.model');
const Activity = require('../models/activity.model');
const upload = require('../utils/fileUpload');
const { protect, authorize } = require('../middleware/auth.middleware');

// All student routes require authentication
router.use(protect);
router.use(authorize('student'));

// GET /api/students/me — get full profile (user + student doc merged)
router.get('/me', async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        res.json({
            success: true,
            data: {
                id: student._id,
                userId: req.user._id,
                name: req.user.name,
                email: req.user.email,
                course: req.user.branch,
                skills: student.skills,
                education: student.education,
                projects: student.projects,
                status: student.status,
                resume: student.resume,
                notifications: student.notifications,
                events: student.events,
                statusHistory: student.statusHistory
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/students/me — update profile fields
router.put('/me', async (req, res) => {
    try {
        const { name, skills, education, projects } = req.body;

        // Update user's display name if provided
        if (name) {
            await User.findByIdAndUpdate(req.user._id, { name });
        }

        const student = await Student.findOneAndUpdate(
            { user: req.user._id },
            { skills, education, projects },
            { new: true, runValidators: true }
        );

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/students/me/resume — upload PDF resume
router.post('/me/resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const resumeData = {
            name: req.file.originalname,
            path: `/uploads/${req.file.filename}`,
            uploadedAt: new Date(),
            approved: false
        };

        const student = await Student.findOneAndUpdate(
            { user: req.user._id },
            { resume: resumeData },
            { new: true }
        );

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        await Activity.create({
            type: 'upload',
            title: `Resume uploaded by ${req.user.name}`
        });

        res.json({ success: true, message: 'Resume uploaded successfully', data: resumeData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/students/me/notifications
router.get('/me/notifications', async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }
        res.json({ success: true, data: student.notifications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/students/me/notifications/read — mark all notifications read
router.put('/me/notifications/read', async (req, res) => {
    try {
        await Student.updateOne(
            { user: req.user._id },
            { $set: { 'notifications.$[].read': true } }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/students/me/events — add event to personal calendar
router.post('/me/events', async (req, res) => {
    try {
        const { title, date, description } = req.body;
        if (!title || !date) {
            return res.status(400).json({ success: false, message: 'Title and date are required' });
        }

        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        // Prevent duplicate calendar entries
        const alreadyAdded = student.events.some(e => e.title === title && e.date === date);
        if (alreadyAdded) {
            return res.status(400).json({ success: false, message: 'Event already in your calendar' });
        }

        student.events.push({ title, date, description, addedAt: new Date() });
        await student.save();

        res.json({ success: true, message: 'Event added to calendar' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/students/me/events/:eventId — remove event from calendar
router.delete('/me/events/:eventId', async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        student.events = student.events.filter(e => e._id.toString() !== req.params.eventId);
        await student.save();

        res.json({ success: true, message: 'Event removed from calendar' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
