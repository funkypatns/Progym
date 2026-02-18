/**
 * ============================================
 * LICENSE SERVER - MAIN ENTRY POINT
 * ============================================
 * 
 * Secure license validation server for Gym Management System.
 * Handles license activation, validation, and management.
 * 
 * Author: Omar Habib Software
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const path = require('path');

const licenseRoutes = require('./routes/licenses');
const legacyAdminRoutes = require('./routes/admin');
const integrityRoutes = require('./routes/integrity');
const licenseAdminRoutes = require('./routes/licenseAdmin');
const publicRoutes = require('./routes/public');
const { initDatabase } = require('./database');
const { initFileLogger } = require('./utils/fileLogger');

const app = express();
const PORT = process.env.PORT || 4000;
const LICENSE_SERVER_DATA_PATH = process.env.LICENSE_SERVER_DATA_PATH || path.join(__dirname, '..', 'data');
const loggerState = initFileLogger({
    serviceName: 'license-server',
    logsDir: path.join(LICENSE_SERVER_DATA_PATH, 'logs')
});

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet()); // Security headers
app.use(cors({
    origin: '*', // In production, restrict to known clients
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// ROUTES
// ============================================

// Root - friendly status
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'License server is running',
        endpoints: {
            health: '/health',
            activate: '/api/licenses/activate',
            validate: '/api/licenses/validate',
            heartbeat: '/api/licenses/heartbeat',
            status: '/api/licenses/status/:key',
            publicKey: '/api/licenses/public-key',
            vendorProfile: '/api/public/vendor-profile',
            manifest: '/api/integrity/manifest?version=...',
            licenseAdmin: '/admin'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Admin UI aliases (HTTP access only)
app.get('/admin-ui', (req, res) => res.redirect('/admin'));
app.get('/admin-ui/login', (req, res) => res.redirect('/admin/login'));
app.get('/admin-ui/dashboard', (req, res) => res.redirect('/admin'));
app.get('/admin-ui/vendor-profile', (req, res) => res.redirect('/admin/vendor-profile'));

// License validation routes (public)
app.use('/api/licenses', licenseRoutes);
app.use('/api/integrity', integrityRoutes);
app.use('/api/public', publicRoutes);
app.use('/admin', licenseAdminRoutes);
app.use('/api/admin', licenseAdminRoutes);

// Legacy admin routes (kept for backward compatibility)
app.use('/api/admin/legacy', legacyAdminRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
    try {
        // Initialize database
        await initDatabase();
        console.log('📦 Database initialized');

        app.listen(PORT, () => {
            console.log('');
            console.log('🔐 License Server for Gym Management System');
            console.log(`🚀 Running on http://localhost:${PORT}`);
            console.log(`🪵 Error logs: ${loggerState.errorLogPath}`);
            console.log('');
            console.log('Endpoints:');
            console.log('  POST /api/licenses/activate   - Activate license');
            console.log('  POST /api/licenses/validate   - Validate license');
            console.log('  POST /api/licenses/heartbeat  - Heartbeat device');
            console.log('  GET  /api/licenses/status/:key - Check status');
            console.log('  GET  /api/licenses/public-key - Get RS256 public key');
            console.log('  GET  /api/public/vendor-profile - Public vendor support profile');
            console.log('  GET  /api/integrity/manifest?version=... - Get signed integrity manifest');
            console.log('  GET  /admin                   - License admin dashboard');
            console.log('  GET  /admin/login             - License admin login');
            console.log('  GET  /admin/vendor-profile    - Vendor profile admin page');
            console.log('  POST /api/admin/login         - License admin API login');
            console.log('  GET  /api/admin/licenses      - License admin API list licenses');
            console.log('  GET  /api/admin/legacy/*      - Legacy admin API routes');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
