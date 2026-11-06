const { validationResult } = require('express-validator');

// Use after a chain of express-validator checks: replies 400 with a readable `message`
// (the first problem) plus the full `errors` list.
module.exports = function validate(req, res, next) {
    const result = validationResult(req);
    if (result.isEmpty()) return next();
    const errors = result.array();
    res.status(400).json({ success: false, message: errors[0].msg, errors });
};
