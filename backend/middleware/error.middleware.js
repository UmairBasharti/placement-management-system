// Central error handler. Routes call next(err); this maps known error types to clean client
// responses and never leaks internals (database messages, stack traces). Details go to the server log.
module.exports = function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    // Mongoose schema validation — these messages are our own ("Company name is required", …)
    if (err.name === 'ValidationError' && err.errors) {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, message: errors[0], errors });
    }

    // Malformed ObjectId or wrong type in a query/URL
    if (err.name === 'CastError') {
        const message = err.path === '_id' ? 'Invalid id' : `Invalid value for ${err.path}`;
        return res.status(400).json({ success: false, message });
    }

    // Unique index violation
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0];
        const message = field === 'email' ? 'Email already registered' : 'A record with this value already exists';
        return res.status(409).json({ success: false, message });
    }

    // Body-parser problems
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body too large' });
    }

    // Anything else: log everything, tell the client nothing
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\n`, err.stack || err);
    res.status(500).json({ success: false, message: 'Internal server error' });
};
