const express = require('express');
const User = require('../models/user.model');
const Student = require('../models/student.model');
const Application = require('../models/application.model');
const Company = require('../models/company.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');
const { sendResumeFile } = require('../utils/fileUpload');
const { matchStudents } = require('../utils/matcher');

const router = express.Router();
router.use(protect, authorize('admin'));

const PLACEMENT_STATUSES = ['Unplaced', 'Under Review', 'Interview Scheduled', 'Placed'];

// GET /api/admin/stats — dashboard numbers and chart data
router.get('/stats', async (req, res, next) => {
    try {
        const [totalStudents, placedStudents, totalCompanies, totalApplications, statusBreakdown, branchBreakdown] = await Promise.all([
            Student.countDocuments(),
            Student.countDocuments({ status: 'Placed' }),
            Company.countDocuments({ status: 'active' }),
            Application.countDocuments(),
            Student.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            User.aggregate([
                { $match: { role: 'student' } },
                { $group: { _id: '$branch', count: { $sum: 1 } } }
            ])
        ]);

        res.json({
            success: true,
            data: { totalStudents, placedStudents, totalCompanies, totalApplications, statusBreakdown, branchBreakdown }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/activities — latest activity log entries
router.get('/activities', async (req, res, next) => {
    try {
        const activities = await Activity.find().sort({ timestamp: -1 }).limit(10);
        res.json({ success: true, data: activities });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/students — every student with account and profile data merged
router.get('/students', async (req, res, next) => {
    try {
        const students = await Student.find().populate('user', 'name email branch');

        const data = students.filter(s => s.user).map(s => ({
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

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/students/:id/status — set a student's placement status (:id is the student id)
router.put('/students/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!PLACEMENT_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const student = await Student.findById(req.params.id).populate('user', 'name');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        if (student.status !== status) {
            student.status = status;
            student.statusHistory.push({ status, message: 'Status updated by admin' });
        }
        student.notify(`Your placement status has been updated to: ${status}`);
        await student.save();

        await Activity.create({
            type: 'status',
            title: `Status updated for ${student.user ? student.user.name : 'a student'}: ${status}`
        });

        res.json({ success: true, message: 'Student status updated' });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/resumes — students who have uploaded a resume
router.get('/resumes', async (req, res, next) => {
    try {
        const students = await Student.find({ 'resume.fileId': { $ne: null } }).populate('user', 'name email branch');

        const data = students.filter(s => s.user).map(s => ({
            id: s._id,
            name: s.user.name,
            email: s.user.email,
            course: s.user.branch,
            resume: s.resume
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/students/:id/resume — stream a student's resume PDF
router.get('/students/:id/resume', async (req, res, next) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        await sendResumeFile(res, student.resume);
    } catch (error) {
        next(error);
    }
});

// Approve or reject a student's resume (:id is the student id)
function reviewResume(decision) {
    const text = decision === 'approved'
        ? { notice: 'Your resume has been approved', activity: 'approved' }
        : { notice: 'Your resume has been rejected. Please upload a new one.', activity: 'rejected' };

    return async (req, res, next) => {
        try {
            const student = await Student.findById(req.params.id).populate('user', 'name');
            if (!student) {
                return res.status(404).json({ success: false, message: 'Student not found' });
            }
            if (!student.resume || !student.resume.fileId) {
                return res.status(400).json({ success: false, message: 'This student has not uploaded a resume' });
            }

            student.resume.status = decision;
            student.notify(text.notice);
            await student.save();

            await Activity.create({
                type: 'upload',
                title: `Resume ${text.activity} for ${student.user ? student.user.name : 'a student'}`
            });

            res.json({ success: true, message: `Resume ${text.activity}` });
        } catch (error) {
            next(error);
        }
    };
}

router.put('/resumes/:id/approve', reviewResume('approved'));
router.put('/resumes/:id/reject', reviewResume('rejected'));

// GET /api/admin/companies/:id/matches — students (of eligible branches) whose skills fit this job best
router.get('/companies/:id/matches', async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        const students = await Student.find().populate('user', 'name email branch');
        const eligible = students.filter((s) => s.user && company.branches.includes(s.user.branch));

        const data = matchStudents(company, eligible).map((r) => ({
            studentId: r.student._id,
            name: r.student.user.name,
            email: r.student.user.email,
            course: r.student.user.branch,
            status: r.student.status,
            resumeStatus: r.student.resume && r.student.resume.fileId ? r.student.resume.status : 'none',
            matchScore: r.matchScore,
            matchedSkills: r.matchedSkills,
            missingSkills: r.missingSkills
        }));

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/applications — every application with company details
router.get('/applications', async (req, res, next) => {
    try {
        const applications = await Application.find()
            .populate('company', 'name location jobType package')
            .sort({ appliedDate: -1 });
        res.json({ success: true, data: applications });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
