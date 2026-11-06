const express = require('express');
const Company = require('../models/company.model');
const Application = require('../models/application.model');
const Student = require('../models/student.model');
const Activity = require('../models/activity.model');
const { protect, authorize } = require('../middleware/auth.middleware');
const { BRANCHES } = require('../config/constants');
const { parseSkillList } = require('../utils/skills');
const { studentSkills, recommendCompanies } = require('../utils/matcher');

const router = express.Router();

const MAX_REQUIRED_SKILLS = 20;

// Companies a student may see: active and open to their branch
const visibleToStudent = (user) => ({ status: 'active', ...(user.branch && { branches: user.branch }) });

// Array or single value → clean, de-duplicated list (null when empty). Unknown branch names are
// rejected by the schema's enum (→ 400 from the error handler).
function parseBranches(input) {
    const list = (Array.isArray(input) ? input : [input])
        .filter((b) => typeof b === 'string' && b.trim())
        .map((b) => b.trim());
    return list.length ? [...new Set(list)] : null;
}

// Array or comma-separated text → canonical skill names (known skills are normalised, others kept as typed)
function parseRequiredSkills(input) {
    const text = Array.isArray(input) ? input.join(', ') : String(input ?? '');
    return parseSkillList(text).slice(0, MAX_REQUIRED_SKILLS);
}

// Fields an admin can change through PUT (no mass assignment of notes, postedDate, _id …)
const EDITABLE_FIELDS = ['name', 'description', 'location', 'jobType', 'requirements', 'package', 'status'];

const branchesRequired = () => ({ success: false, message: `Select at least one branch (${BRANCHES.join(', ')})` });

// GET /api/companies — active companies; students only see those open to their branch (and no admin notes)
router.get('/', protect, async (req, res, next) => {
    try {
        const isStudent = req.user.role === 'student';
        const finder = Company.find(isStudent ? visibleToStudent(req.user) : { status: 'active' }).sort({ postedDate: -1 });
        if (isStudent) finder.select('-notes');
        res.json({ success: true, data: await finder });
    } catch (error) {
        next(error);
    }
});

// GET /api/companies/recommended — student: jobs ranked by how well they match the student's skills.
// Declared before "/:id" so that "recommended" is not treated as an id.
router.get('/recommended', protect, authorize('student'), async (req, res, next) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 50);

        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const applied = await Application.find({ student: student._id }).distinct('company');
        const companies = await Company.find({ ...visibleToStudent(req.user), _id: { $nin: applied } }).select('-notes');

        const data = recommendCompanies(student, companies, { limit }).map((r) => ({
            company: r.company,
            matchScore: r.matchScore,
            matchedSkills: r.matchedSkills,
            missingSkills: r.missingSkills
        }));

        res.json({ success: true, data, meta: { hasSkills: studentSkills(student).size > 0 } });
    } catch (error) {
        next(error);
    }
});

// GET /api/companies/:id — students: an eligible company; admins: any company plus application stats
router.get('/:id', protect, async (req, res, next) => {
    try {
        if (req.user.role === 'student') {
            const visible = await Company.findOne({ _id: req.params.id, ...visibleToStudent(req.user) }).select('-notes');
            if (!visible) {
                return res.status(404).json({ success: false, message: 'Company not found' });
            }
            return res.json({ success: true, data: visible });
        }

        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        const applications = await Application.find({ company: company._id }).select('status');
        const count = (status) => applications.filter((a) => a.status === status).length;
        const stats = { total: applications.length, accepted: count('Accepted'), pending: count('Pending'), rejected: count('Rejected') };

        res.json({ success: true, data: { ...company.toObject(), stats } });
    } catch (error) {
        next(error);
    }
});

// POST /api/companies — admin: add a company
router.post('/', protect, authorize('admin'), async (req, res, next) => {
    try {
        const { name, description, location, jobType, requirements, package: pkg } = req.body;

        const branches = parseBranches(req.body.branches);
        if (!branches) return res.status(400).json(branchesRequired());

        const company = await Company.create({
            name, description, location, jobType, branches, requirements, package: pkg,
            requiredSkills: parseRequiredSkills(req.body.requiredSkills),
            postedDate: new Date()
        });

        await Activity.create({ type: 'company', title: `New company added: ${company.name}` });

        res.status(201).json({ success: true, data: company, message: 'Company added successfully' });
    } catch (error) {
        next(error);
    }
});

// PUT /api/companies/:id — admin: update a company
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const updateData = {};
        for (const field of EDITABLE_FIELDS) {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];   // '' clears a field
        }
        if (req.body.branches !== undefined) {
            const branches = parseBranches(req.body.branches);
            if (!branches) return res.status(400).json(branchesRequired());
            updateData.branches = branches;
        }
        if (req.body.requiredSkills !== undefined) {
            updateData.requiredSkills = parseRequiredSkills(req.body.requiredSkills);
        }

        const company = await Company.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        await Activity.create({ type: 'company', title: `Company updated: ${company.name}` });

        res.json({ success: true, data: company, message: 'Company updated successfully' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/companies/:id — admin: remove a company from the lists.
// The record is archived (status "inactive"), not destroyed, so existing applications and student history stay intact.
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
        if (!company) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        await Activity.create({ type: 'company', title: `Company removed: ${company.name}` });

        res.json({ success: true, message: 'Company removed. Existing applications are kept.' });
    } catch (error) {
        next(error);
    }
});

// POST /api/companies/:id/notes — admin: add an internal note
router.post('/:id/notes', protect, authorize('admin'), async (req, res, next) => {
    try {
        const text = String(req.body.text || '').trim();
        if (!text) {
            return res.status(400).json({ success: false, message: 'Note text is required' });
        }
        if (text.length > 500) {
            return res.status(400).json({ success: false, message: 'Notes can be at most 500 characters' });
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
