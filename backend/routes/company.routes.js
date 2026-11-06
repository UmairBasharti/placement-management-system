const express = require('express');
const router = express.Router();
const Company = require('../models/company.model');
const Application = require('../models/application.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');
const { BRANCHES } = require('../config/constants');

// GET /api/companies — list all active companies
// Both students and admins can access; students see only companies matching their branch
router.get('/', protect, async (req, res, next) => {
    try {
        let query = { status: 'active' };

        // Students only see companies relevant to their branch
        if (req.user.role === 'student' && req.user.branch) {
            query.branches = req.user.branch;
        }

        const finder = Company.find(query).sort({ postedDate: -1 });
        if (req.user.role === 'student') finder.select('-notes');   // admin-private notes

        res.json({ success: true, data: await finder });
    } catch (error) {
        next(error);
    }
});

// GET /api/companies/:id — single company with application count
router.get('/:id', protect, async (req, res, next) => {
    try {
        // Students may only open active companies that match their branch — and never see admin notes
        if (req.user.role === 'student') {
            const filter = { _id: req.params.id, status: 'active' };
            if (req.user.branch) filter.branches = req.user.branch;
            const visible = await Company.findOne(filter).select('-notes');
            if (!visible) {
                return res.status(404).json({ success: false, message: 'Company not found' });
            }
            return res.json({ success: true, data: visible });
        }

        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Include application stats (admin only)
        const applications = await Application.find({ company: req.params.id });
        const stats = {
            total: applications.length,
            accepted: applications.filter(a => a.status === 'Accepted').length,
            pending: applications.filter(a => a.status === 'Pending').length,
            rejected: applications.filter(a => a.status === 'Rejected').length
        };

        res.json({ success: true, data: { ...company.toObject(), stats } });
    } catch (error) {
        next(error);
    }
});

// Accepts an array or a single value; returns a clean, de-duplicated list or null if empty.
// Unknown branch names are rejected by the schema's enum (-> 400 from the error handler).
function parseBranches(input) {
    const list = (Array.isArray(input) ? input : [input])
        .filter(b => typeof b === 'string' && b.trim())
        .map(b => b.trim());
    return list.length ? [...new Set(list)] : null;
}

// Only these fields can be changed through PUT (no mass assignment of notes, postedDate, _id …)
const EDITABLE_FIELDS = ['name', 'description', 'location', 'jobType', 'requirements', 'package', 'status'];

// POST /api/companies — admin only: add new company
router.post('/', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { name, description, location, jobType, requirements, package: pkg } = req.body;

        const branches = parseBranches(req.body.branches);
        if (!branches) {
            return res.status(400).json({ success: false, message: `Select at least one branch (${BRANCHES.join(', ')})` });
        }

        const company = await Company.create({
            name, description, location, jobType,
            branches,
            requirements,
            package: pkg,
            postedDate: new Date()
        });

        await Activity.create({
            type: 'company',
            title: `New company added: ${company.name}`
        });

        res.status(201).json({ success: true, data: company, message: 'Company added successfully' });
    } catch (error) {
        next(error);
    }
});

// PUT /api/companies/:id — admin only: update company
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const updateData = {};
        for (const field of EDITABLE_FIELDS) {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];   // '' is allowed (clears a field)
        }
        if (req.body.branches !== undefined) {
            const branches = parseBranches(req.body.branches);
            if (!branches) {
                return res.status(400).json({ success: false, message: `Select at least one branch (${BRANCHES.join(', ')})` });
            }
            updateData.branches = branches;
        }

        const company = await Company.findByIdAndUpdate(req.params.id, updateData, {
            new: true, runValidators: true
        });

        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        await Activity.create({
            type: 'company',
            title: `Company updated: ${company.name}`
        });

        res.json({ success: true, data: company, message: 'Company updated successfully' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/companies/:id — admin only: permanently delete + remove applications
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        // Delete all applications for this company
        await Application.deleteMany({ company: req.params.id });

        // Hard delete the company
        await Company.findByIdAndDelete(req.params.id);

        await Activity.create({
            type: 'company',
            title: `Company deleted: ${company.name}`
        });

        res.json({ success: true, message: 'Company and its applications deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// POST /api/companies/:id/notes — admin: add a note to a company
router.post('/:id/notes', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Note text is required' });
        }

        const company = await Company.findByIdAndUpdate(
            req.params.id,
            { $push: { notes: { text, date: new Date() } } },
            { new: true }
        );

        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        res.json({ success: true, data: company.notes, message: 'Note added' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
