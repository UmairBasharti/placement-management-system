const express = require('express');
const router = express.Router();
const Application = require('../models/application.model');
const Student = require('../models/student.model');
const Company = require('../models/company.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');

// GET /api/applications/my — student: get own applications
router.get('/my', protect, authorize('student'), async (req, res, next) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const applications = await Application.find({ student: student._id })
            .populate('company', 'name location jobType package')
            .sort({ appliedDate: -1 });

        res.json({ success: true, data: applications });
    } catch (error) {
        next(error);
    }
});

// POST /api/applications — student: submit an application
router.post('/', protect, authorize('student'), async (req, res, next) => {
    try {
        const { companyId } = req.body;
        if (!companyId) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        // Enforce: must have uploaded a resume
        if (!student.resume || !student.resume.path) {
            return res.status(400).json({ success: false, message: 'Please upload your resume before applying' });
        }

        // Enforce: profile must have skills filled in
        if (!student.skills || !student.skills.trim()) {
            return res.status(400).json({ success: false, message: 'Please complete your profile (skills required) before applying' });
        }

        // Check for duplicate application — the unique index will also catch this
        const existing = await Application.findOne({ student: student._id, company: companyId });
        if (existing) {
            return res.status(400).json({ success: false, message: 'You have already applied to this company' });
        }

        const application = await Application.create({
            student: student._id,
            company: companyId,
            studentName: req.user.name,
            studentEmail: req.user.email,
            course: req.user.branch || '',
            skills: student.skills,
            resumeName: student.resume.name
        });

        // Update student placement status to "Under Review"
        student.status = 'Under Review';
        student.statusHistory.push({
            status: 'Under Review',
            message: `Applied to ${company.name}`,
            timestamp: new Date()
        });
        student.notifications.push({
            message: `Your application to ${company.name} has been submitted`,
            timestamp: new Date()
        });
        await student.save();

        await Activity.create({
            type: 'application',
            title: `${req.user.name} applied to ${company.name}`
        });

        res.status(201).json({ success: true, data: application, message: 'Application submitted successfully' });
    } catch (error) {
        // Unique index violation
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'You have already applied to this company' });
        }
        next(error);
    }
});

// PUT /api/applications/:id/status — admin: accept or reject an application
router.put('/:id/status', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['Accepted', 'Rejected', 'Pending'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const application = await Application.findById(req.params.id).populate('company', 'name');
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        const oldStatus = application.status;
        application.status = status;
        await application.save();

        // Cascade status to the student's placement status
        const student = await Student.findById(application.student);
        if (student) {
            if (status === 'Accepted') {
                student.status = 'Placed';
            } else if (status === 'Rejected' && oldStatus === 'Pending') {
                student.status = 'Unplaced';
            }

            student.notifications.push({
                message: `Your application to ${application.company.name} was ${status.toLowerCase()}`,
                timestamp: new Date()
            });

            student.statusHistory.push({
                status: student.status,
                message: `Application to ${application.company.name}: ${status}`,
                timestamp: new Date()
            });

            await student.save();
        }

        await Activity.create({
            type: 'status',
            title: `Application ${status.toLowerCase()} for ${application.studentName} at ${application.company.name}`
        });

        res.json({ success: true, message: `Application ${status.toLowerCase()} successfully` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
