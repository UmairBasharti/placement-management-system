const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

// Some routers/ISPs refuse the DNS SRV lookups Node makes for mongodb+srv:// URIs
// ("querySrv ECONNREFUSED"). Set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env to work around it.
if (process.env.DNS_SERVERS) {
    require('dns').setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

require('./config/validateEnv')(['MONGODB_URI', 'JWT_SECRET']);

const app = express();
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// Behind a reverse proxy (Render, Railway, nginx…) set TRUST_PROXY=1 so rate limiting sees real client IPs
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            upgradeInsecureRequests: null   // would break plain-http local development (notably in Safari)
        }
    },
    // allow-popups: the "View resume" tab is opened with window.open()
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));

// The frontend is served by this same server, so cross-origin API access is OFF unless
// CLIENT_ORIGIN (comma-separated list) is set — e.g. when hosting the frontend elsewhere.
app.use(cors({
    origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim()) : false
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Resumes are personal data: they live in GridFS and are only available through the authenticated
// /resume routes (a student's own file, or any file for an admin), never as a public URL.

// Frontend static files (index.html is served for "/")
app.use(express.static(FRONTEND_DIR));

// Rate limiting (in-memory; fine for a single instance)
const limiter = (windowMs, limit, message, extra = {}) => rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { success: false, message }, ...extra
});
app.use('/api', limiter(15 * 60 * 1000, 600, 'Too many requests. Please slow down.'));
// Login: only FAILED attempts count, so normal use is never throttled but brute force is
app.use('/api/auth/login', limiter(15 * 60 * 1000, 10, 'Too many failed login attempts. Try again in 15 minutes.', { skipSuccessfulRequests: true }));
app.use('/api/auth/register', limiter(60 * 60 * 1000, 20, 'Too many registrations from this address. Try again later.'));

// Routes
app.get('/api/health', (req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'connected' : 'disconnected', uptime: Math.round(process.uptime()) });
});

app.use('/api/public',       require('./routes/public.routes'));
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/students',     require('./routes/student.routes'));
app.use('/api/companies',    require('./routes/company.routes'));
app.use('/api/applications', require('./routes/application.routes'));
app.use('/api/admin',        require('./routes/admin.routes'));
app.use('/api/events',       require('./routes/event.routes'));

// Unknown API routes get JSON, never the home page
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found' });
});

// Everything else that isn't a real file is a genuine 404 (not the home page)
app.use((req, res) => {
    if (req.method === 'GET' && req.accepts('html')) {
        return res.status(404).sendFile(path.join(FRONTEND_DIR, '404.html'));
    }
    res.status(404).json({ success: false, message: 'Not found' });
});

// Central error handler (maps known errors to clean responses; never leaks internals)
app.use(require('./middleware/error.middleware'));

// Startup: connect to the database FIRST, exit if it fails
async function start() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        console.error('   Check MONGODB_URI, your Atlas IP access list and — on some networks — DNS_SERVERS in backend/.env');
        process.exit(1);
    }

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown: stop accepting requests, close the DB, then exit
    const shutdown = (signal) => {
        console.log(`\n${signal} received — shutting down`);
        server.close(async () => {
            await mongoose.connection.close();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 10000).unref();   // force-exit if connections hang
    };
    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => shutdown(sig)));
}

if (require.main === module) start();

module.exports = app;   // exported so tests (Supertest) can use the app without listening
