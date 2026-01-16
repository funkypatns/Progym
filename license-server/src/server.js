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

const licenseRoutes = require('./routes/licenses');
const adminRoutes = require('./routes/admin');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 4000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet()); // Security headers
app.use(cors({
    origin: '*', // In production, restrict to known clients
    methods: ['GET', 'POST', 'PUT', 'DELETE']
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// License validation routes (public)
app.use('/api/licenses', licenseRoutes);

// Admin routes (protected)
app.use('/api/admin', adminRoutes);

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
            console.log('');
            console.log('Endpoints:');
            console.log('  POST /api/licenses/activate   - Activate license');
            console.log('  POST /api/licenses/validate   - Validate license');
            console.log('  GET  /api/licenses/status     - Check status');
            console.log('  POST /api/admin/login         - Admin login');
            console.log('  GET  /api/admin/licenses      - List all licenses');
            console.log('');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
