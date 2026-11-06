const express = require('express');
const router = express.Router();
const Student = require('../models/student.model');
const User = require('../models/user.model');
const Activity = require('../models/activity.model');
const {
    resumeUpload, resolveUploadPath, isPdfFile, removeFile, cleanFileName, sendResumeFile
} = require('../utils/fileUpload');
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
router.post('/me/resume', resumeUpload, async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Authoritative check: the file must really be a PDF, whatever the client claimed
        if (!(await isPdfFile(req.file.path))) {
            await removeFile(req.file.path);
            return res.status(400).json({ success: false, message: 'The uploaded file is not a valid PDF' });
        }

        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            await removeFile(req.file.path);
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const previousFile = student.resume && student.resume.path;

        // `path` holds only the stored file name; the file is served via the authenticated route below
        student.resume = {
            name: cleanFileName(req.file.originalname),
            path: req.file.filename,
            uploadedAt: new Date(),
            approved: false
        };
        await student.save();

        if (previousFile) await removeFile(resolveUploadPath(previousFile));   // don't leave orphans

        await Activity.create({
            type: 'upload',
            title: `Resume uploaded by ${req.user.name}`
        });

        res.json({
            success: true,
            message: 'Resume uploaded successfully',
            data: { name: student.resume.name, uploadedAt: student.resume.uploadedAt, approved: false }
        });
    } catch (error) {
        if (req.file) await removeFile(req.file.path);
        next(error);
    }
});

// GET /api/students/me/resume/file — the student's own resume (login required)
router.get('/me/resume/file', async (req, res, next) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }
        sendResumeFile(res, student.resume);
    } catch (error) {
        next(error);
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
