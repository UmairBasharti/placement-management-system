const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Student = require('../models/student.model');
const Application = require('../models/application.model');
const Company = require('../models/company.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

// GET /api/admin/stats — numbers for the dashboard cards + charts
router.get('/stats', async (req, res) => {
    try {
        const [totalStudents, placedStudents, totalCompanies, totalApplications] = await Promise.all([
            Student.countDocuments(),
            Student.countDocuments({ status: 'Placed' }),
            Company.countDocuments({ status: 'active' }),
            Application.countDocuments()
        ]);

        // Status breakdown for the doughnut chart
        const statusBreakdown = await Student.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Branch breakdown for the bar chart
        const branchBreakdown = await User.aggregate([
            { $match: { role: 'student' } },
            { $group: { _id: '$branch', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            data: {
                totalStudents,
                placedStudents,
                totalCompanies,
                totalApplications,
                statusBreakdown,
                branchBreakdown
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/admin/activities — last 10 activity log entries
router.get('/activities', async (req, res) => {
    try {
        const activities = await Activity.find().sort({ timestamp: -1 }).limit(10);
        res.json({ success: true, data: activities });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

// GET /api/admin/students — all students with their user + profile data merged
router.get('/students', async (req, res) => {
    try {
        const students = await Student.find().populate('user', 'name email branch');

        const formatted = students.map(s => ({
            id: s._id,
            userId: s.user._id,
            name: s.user.name,
            email: s.user.email,
            course: s.user.branch,
            skills: s.skills,
            education: s.education,
            projects: s.projects,
            status: s.status,
            resume: s.resume,
            statusHistory: s.statusHistory
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/students/:id/status — update a student's placement status
router.put('/students/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ['Unplaced', 'Under Review', 'Interview Scheduled', 'Placed'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const student = await Student.findById(req.params.id).populate('user', 'name');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        student.status = status;
        student.notifications.push({
            message: `Your placement status has been updated to: ${status}`,
            timestamp: new Date()
        });
        student.statusHistory.push({
            status,
            message: `Status updated by admin`,
            timestamp: new Date()
        });
        await student.save();

        await Activity.create({
            type: 'status',
            title: `Status updated for ${student.user.name}: ${status}`
        });

        res.json({ success: true, message: 'Student status updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── RESUMES ──────────────────────────────────────────────────────────────────

// GET /api/admin/resumes — all students who have uploaded a resume
router.get('/resumes', async (req, res) => {
    try {
        const students = await Student.find({ 'resume.path': { $ne: null } })
            .populate('user', 'name email branch');

        const formatted = students.map(s => ({
            id: s._id,
            name: s.user.name,
            email: s.user.email,
            course: s.user.branch,
            resume: s.resume
        }));

        res.json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/resumes/:id/approve
router.put('/resumes/:id/approve', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('user', 'name');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        student.resume.approved = true;
        student.notifications.push({
            message: 'Your resume has been approved',
            timestamp: new Date()
        });
        await student.save();

        await Activity.create({
            type: 'upload',
            title: `Resume approved for ${student.user.name}`
        });

        res.json({ success: true, message: 'Resume approved' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/admin/resumes/:id/reject
router.put('/resumes/:id/reject', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).populate('user', 'name');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        student.resume.approved = false;
        student.notifications.push({
            message: 'Your resume has been rejected. Please upload a new one.',
            timestamp: new Date()
        });
        await student.save();

        await Activity.create({
            type: 'upload',
            title: `Resume rejected for ${student.user.name}`
        });

        res.json({ success: true, message: 'Resume rejected' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── APPLICATIONS ─────────────────────────────────────────────────────────────

// GET /api/admin/applications — all applications with student + company info
router.get('/applications', async (req, res) => {
    try {
        const applications = await Application.find()
            .populate('company', 'name location jobType package')
            .sort({ appliedDate: -1 });

        res.json({ success: true, data: applications });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
