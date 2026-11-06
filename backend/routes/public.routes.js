const express = require('express');
const Student = require('../models/student.model');
const Company = require('../models/company.model');
const { BRANCHES, JOB_TYPES, PASSWORD_MIN, PASSWORD_MAX } = require('../config/constants');

const router = express.Router();

// GET /api/public/stats — a few headline numbers for the home page (counts only, no personal data)
router.get('/stats', async (req, res, next) => {
    try {
        const [students, companies, placed] = await Promise.all([
            Student.countDocuments(),
            Company.countDocuments({ status: 'active' }),
            Student.countDocuments({ status: 'Placed' })
        ]);
        res.set('Cache-Control', 'public, max-age=60');
        res.json({ success: true, data: { students, companies, placed } });
    } catch (error) {
        next(error);
    }
});

// GET /api/public/meta — option lists and limits used by the forms (branches, job types, password length)
router.get('/meta', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ success: true, data: { branches: BRANCHES, jobTypes: JOB_TYPES, passwordMin: PASSWORD_MIN, passwordMax: PASSWORD_MAX } });
});

module.exports = router;
