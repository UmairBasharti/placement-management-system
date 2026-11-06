const express = require('express');
const { body } = require('express-validator');
const Student = require('../models/student.model');
const User = require('../models/user.model');
const Event = require('../models/event.model');
const Activity = require('../models/activity.model');
const { resumeUpload, isPdfBuffer, cleanFileName, saveResume, deleteResume, readResume, sendResumeFile } = require('../utils/fileUpload');
const { extractPdfText, parseResume, ResumeReadError } = require('../utils/resumeParser');
const { protect, authorize } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(protect, authorize('student'));

async function findStudent(req, res) {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) res.status(404).json({ success: false, message: 'Student profile not found' });
    return student;
}

// GET /api/students/me — profile (user + student data merged)
router.get('/me', async (req, res, next) => {
    try {
        const student = await findStudent(req, res);
        if (!student) return;

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
        next(error);
    }
});

// PUT /api/students/me — update profile fields
router.put('/me', [
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1–100 characters'),
    body('skills').optional().isString().trim().isLength({ max: 500 }).withMessage('Skills can be at most 500 characters'),
    body('education').optional().isString().trim().isLength({ max: 1500 }).withMessage('Education can be at most 1500 characters'),
    body('projects').optional().isString().trim().isLength({ max: 2500 }).withMessage('Projects can be at most 2500 characters'),
    validate
], async (req, res, next) => {
    try {
        const { name, skills, education, projects } = req.body;

        if (name) await User.findByIdAndUpdate(req.user._id, { name });

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
        next(error);
    }
});

// POST /api/students/me/resume — upload a PDF (stored in GridFS; needs admin approval before applying)
router.post('/me/resume', resumeUpload, async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        if (!isPdfBuffer(req.file.buffer)) {
            return res.status(400).json({ success: false, message: 'The uploaded file is not a valid PDF' });
        }

        const student = await findStudent(req, res);
        if (!student) return;

        const previousFileId = student.resume && student.resume.fileId;
        const name = cleanFileName(req.file.originalname);
        const fileId = await saveResume(req.file.buffer, name);

        try {
            student.resume = { name, fileId, uploadedAt: new Date(), status: 'pending' };
            await student.save();
        } catch (err) {
            await deleteResume(fileId);   // don't leave an orphaned file if the metadata could not be saved
            throw err;
        }
        await deleteResume(previousFileId);

        await Activity.create({ type: 'upload', title: `Resume uploaded by ${req.user.name}` });

        res.json({
            success: true,
            message: 'Resume uploaded successfully',
            data: { name, uploadedAt: student.resume.uploadedAt, status: 'pending' }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/students/me/resume/file — the student's own resume
router.get('/me/resume/file', async (req, res, next) => {
    try {
        const student = await findStudent(req, res);
        if (student) await sendResumeFile(res, student.resume);
    } catch (error) {
        next(error);
    }
});

// GET /api/students/me/resume/suggestions — read the stored resume and suggest skills, education and projects.
// Nothing is saved: the student reviews the suggestions and applies the ones they want via PUT /me.
router.get('/me/resume/suggestions', async (req, res, next) => {
    try {
        const student = await findStudent(req, res);
        if (!student) return;
        if (!student.resume || !student.resume.fileId) {
            return res.status(400).json({ success: false, message: 'Upload a resume first' });
        }

        let text;
        try {
            text = await extractPdfText(await readResume(student.resume.fileId));
        } catch (err) {
            if (err instanceof ResumeReadError) {
                return res.status(422).json({ success: false, message: `${err.message}. You can fill in your profile by hand.` });
            }
            throw err;
        }

        res.json({ success: true, data: { ...parseResume(text), textFound: text.trim().length > 0 } });
    } catch (error) {
        next(error);
    }
});

// GET /api/students/me/notifications
router.get('/me/notifications', async (req, res, next) => {
    try {
        const student = await findStudent(req, res);
        if (student) res.json({ success: true, data: student.notifications });
    } catch (error) {
        next(error);
    }
});

// PUT /api/students/me/notifications/read — mark all as read
router.put('/me/notifications/read', async (req, res, next) => {
    try {
        await Student.updateOne({ user: req.user._id }, { $set: { 'notifications.$[].read': true } });
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
});

// POST /api/students/me/events — add an event to the personal calendar { eventId }
router.post('/me/events', async (req, res, next) => {
    try {
        const { eventId } = req.body;
        if (!eventId) {
            return res.status(400).json({ success: false, message: 'eventId is required' });
        }

        const event = await Event.findById(eventId);   // title/date come from the stored event, not the client
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const student = await findStudent(req, res);
        if (!student) return;

        if (student.events.some(e => String(e.eventId) === String(event._id))) {
            return res.status(400).json({ success: false, message: 'Event already in your calendar' });
        }

        student.events.push({ eventId: event._id, title: event.title, date: event.date, description: event.description });
        await student.save();

        res.json({ success: true, message: 'Event added to calendar' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/students/me/events/:eventId — remove an event from the personal calendar
router.delete('/me/events/:eventId', async (req, res, next) => {
    try {
        const student = await findStudent(req, res);
        if (!student) return;

        const id = req.params.eventId;
        student.events = student.events.filter(e => String(e.eventId) !== id && String(e._id) !== id);
        await student.save();

        res.json({ success: true, message: 'Event removed from calendar' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
