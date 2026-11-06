const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

// Some routers/ISPs refuse the DNS SRV lookups Node makes for mongodb+srv:// URIs
// ("querySrv ECONNREFUSED"). Set DNS_SERVERS=8.8.8.8,1.1.1.1 in .env to work around it.
if (process.env.DNS_SERVERS) {
    require('dns').setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

require('./config/validateEnv')(['MONGODB_URI', 'JWT_SECRET']);

const app = express();

// Ensure uploads directory exists at startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (resumes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files from the frontend/ directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const authRoutes        = require('./routes/auth.routes');
const studentRoutes     = require('./routes/student.routes');
const companyRoutes     = require('./routes/company.routes');
const applicationRoutes = require('./routes/application.routes');
const adminRoutes       = require('./routes/admin.routes');
const eventRoutes       = require('./routes/event.routes');

app.use('/api/auth',         authRoutes);
app.use('/api/students',     studentRoutes);
app.use('/api/companies',    companyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/events',       eventRoutes);

// MongoDB Connection — Mongoose 7+ does not need deprecated options
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// Fix #9: Catch-all — serve index.html for any non-API route (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
