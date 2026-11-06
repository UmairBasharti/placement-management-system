const express = require('express');
const router = express.Router();
const Application = require('../models/application.model');
const Student = require('../models/student.model');
const Company = require('../models/company.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');
const { afterApply, afterDecision } = require('../utils/placementStatus');
const { isObjectIdString } = require('../utils/objectId');

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
        if (!isObjectIdString(companyId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Enforce: the company must be open and eligible for this student's branch
        if (company.status !== 'active') {
            return res.status(400).json({ success: false, message: 'This company is not accepting applications' });
        }
        if (!company.branches.includes(req.user.branch)) {
            return res.status(403).json({ success: false, message: 'This opportunity is not open to your branch' });
        }

        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        // Enforce: must have uploaded a resume, and the placement cell must have approved it
        if (!student.resume || !student.resume.fileId) {
            return res.status(400).json({ success: false, message: 'Please upload your resume before applying' });
        }
        if (student.resume.status === 'rejected') {
            return res.status(400).json({ success: false, message: 'Your resume was rejected — please upload a new one before applying' });
        }
        if (student.resume.status !== 'approved') {
            return res.status(400).json({ success: false, message: 'Your resume is waiting for approval by the placement cell — you can apply once it is approved' });
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

        // Unplaced → Under Review (never downgrade Interview Scheduled / Placed students)
        const newStatus = afterApply(student.status);
        if (newStatus !== student.status) {
            student.status = newStatus;
            student.statusHistory.push({
                status: newStatus,
                message: `Applied to ${company.name}`,
                timestamp: new Date()
            });
        }
        student.notify(`Your application to ${company.name} has been submitted`);
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
        if (oldStatus === status) {
            return res.json({ success: true, message: `Application is already ${status.toLowerCase()}` });
        }
        application.status = status;
        await application.save();

        const companyName = application.company ? application.company.name : 'a removed company';

        // Recompute the student's placement status from ALL of their applications
        const student = await Student.findById(application.student);
        if (student) {
            const applications = await Application.find({ student: student._id }).select('status');
            const newStatus = afterDecision({ current: student.status, oldStatus, newStatus: status, applications });

            student.notify(status === 'Pending' ? `Your application to ${companyName} was moved back to pending` : `Your application to ${companyName} was ${status.toLowerCase()}`);

            // The timeline records real placement-status changes only
            if (newStatus !== student.status) {
                student.status = newStatus;
                student.statusHistory.push({
                    status: newStatus,
                    message: `Application to ${companyName}: ${status}`,
                    timestamp: new Date()
                });
            }

            await student.save();
        }

        await Activity.create({
            type: 'status',
            title: `Application ${status.toLowerCase()} for ${application.studentName} at ${companyName}`
        });

        res.json({ success: true, message: `Application ${status.toLowerCase()} successfully` });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
