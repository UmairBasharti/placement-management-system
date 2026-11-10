const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Verify JWT and attach user to request
exports.protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — no token provided'
            });
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — token invalid or expired'
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — user no longer exists'
            });
        }

        // A password reset ends every session that started before it (iat is in whole seconds)
        if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — password was changed, please log in again'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        next(error);
    }
};

// Role-based access control — use after protect
// Usage: authorize('admin') or authorize('admin', 'student')
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied — role '${req.user.role}' cannot access this route`
            });
        }
        next();
    };
};
