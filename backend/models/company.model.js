const mongoose = require('mongoose');
const { BRANCHES, JOB_TYPES } = require('../config/constants');

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    location: {
        type: String,
        required: [true, 'Location is required']
    },
    jobType: {
        type: String,
        enum: JOB_TYPES,
        required: [true, 'Job type is required']
    },
    // Which branches are eligible — e.g. ['MCA', 'MBA']
    branches: [{
        type: String,
        trim: true,
        enum: { values: BRANCHES, message: `Branch must be one of: ${BRANCHES.join(', ')}` }
    }],
    requirements: {
        type: String,
        default: '',
        maxlength: [500, 'Requirements can be at most 500 characters']
    },
    // Skills this job asks for (canonical names); used to match students. If empty, they are read from `requirements`.
    requiredSkills: [{ type: String, trim: true, maxlength: 40 }],
    package: {
        type: String,   // stored as display string e.g. "8-12 LPA"
        default: ''
    },
    postedDate: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    // Admin notes about this company
    notes: [{
        text: { type: String, required: true },
        date: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Company', companySchema);
