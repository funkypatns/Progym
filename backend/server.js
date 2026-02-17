/**
 * ============================================
 * GYM MANAGEMENT SYSTEM - Express Server
 * ============================================
 * 
 * Main entry point for the backend API server.
 * Handles:
 * - Express configuration
 * - Middleware setup
 * - Route registration
 * - Database connection
 * - Error handling
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'file:./gym.db';
}
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
    process.env.PRISMA_CLIENT_ENGINE_TYPE = 'library';
}
const { PrismaClient } = require('@prisma/client');

// Initialize Express app
const app = express();

// Initialize Prisma client
const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Get user data path (set by Electron main process)
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, '..', 'data');

// ============================================
// DATA DIRECTORIES SETUP
// ============================================

/**
 * Ensure all required data directories exist
 */
function setupDataDirectories() {
    const directories = [
        path.join(USER_DATA_PATH, 'data'),
        path.join(USER_DATA_PATH, 'uploads'),
        path.join(USER_DATA_PATH, 'uploads', 'members'),
        path.join(USER_DATA_PATH, 'uploads', 'products'),
        path.join(USER_DATA_PATH, 'faces'),
        path.join(USER_DATA_PATH, 'backups')
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`ðŸ“ Created directory: ${dir}`);
        }
    });
}

// ============================================
// MIDDLEWARE
// ============================================

// CORS - Support both development and production
const corsOrigin = process.env.CORS_ORIGIN || (isDev ? 'http://localhost:5173' : '*');
app.use(cors({
    origin: corsOrigin,
    credentials: true
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploaded images, etc.)
app.use('/uploads', express.static(path.join(USER_DATA_PATH, 'uploads')));

// Request logging middleware (development only)
if (isDev) {
    app.use((req, res, next) => {
        console.log(`ðŸ“¨ ${req.method} ${req.path}`);
        next();
    });
}

// Make prisma available in routes
app.use((req, res, next) => {
    req.prisma = prisma;
    req.userDataPath = USER_DATA_PATH;
    next();
});

// ============================================
// ROUTES
// ============================================

// Import route modules
const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const subscriptionRoutes = require('./routes/subscriptions');
const memberPackageRoutes = require('./routes/member-packages');
const packRoutes = require('./routes/packs');
const packAssignmentsRoutes = require('./routes/pack-assignments');
const planRoutes = require('./routes/plans');
const checkInRoutes = require('./routes/checkin');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const settingRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const backupRoutes = require('./routes/backup');
const licenseRoutes = require('./routes/license');
const analyticsRoutes = require('./routes/analytics');
const packagesRoutes = require('./routes/packages');
const posRoutes = require('./routes/pos');
const cashClosingRoutes = require('./routes/cashClosing');
const usersRoutes = require('./routes/users');
const remindersRoutes = require('./routes/reminders');
const staffNotificationsRoutes = require('./routes/staff-notifications');
const alertsRoutes = require('./routes/alerts');
const receiptsRoutes = require('./routes/receipts');
const staffTrainersRoutes = require('./routes/staffTrainers');
const trainerRoutes = require('./routes/trainers');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/member-packages', memberPackageRoutes);
app.use('/api/member-packs', memberPackageRoutes);
app.use('/api/pack-assignments', packAssignmentsRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/packs', packRoutes);
app.use('/api/package-plans', packRoutes);
app.use('/api/pack-templates', packRoutes);
app.use('/api/checkin', checkInRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api', licenseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/cash-closings', cashClosingRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/notifications', staffNotificationsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/staff-trainers', staffTrainersRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/subscription-alerts', require('./routes/subscription-alerts'));
app.use('/api/cash-movements', require('./routes/cash-movements'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/services', require('./routes/services'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/coaches', require('./routes/coaches'));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: require('./package.json').version
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('âŒ Error:', {
        method: req.method,
        path: req.path,
        message: err?.message,
        code: err?.code,
        name: err?.name,
        meta: err?.meta,
        stack: err?.stack
    });

    // Prisma errors
    if (err.code?.startsWith('P')) {
        let message = 'Database error';
        if (err.code === 'P2002') message = `Unique constraint failed on field: ${err.meta?.target || 'unknown'}`;
        if (err.code === 'P2003') message = `Foreign key constraint failed on field: ${err.meta?.field_name || 'unknown'}`;
        if (err.code === 'P2025') message = 'Record not found';

        return res.status(400).json({
            ok: false,
            reason: 'PRISMA_ERROR',
            message: message,
            code: err.code,
            error: isDev ? err.message : undefined
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            ok: false,
            reason: 'VALIDATION_ERROR',
            message: 'Validation error',
            errors: err.errors
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            ok: false,
            reason: 'INVALID_TOKEN',
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            ok: false,
            reason: 'TOKEN_EXPIRED',
            message: 'Token expired'
        });
    }

    // Generic error
    res.status(err.status || 500).json({
        ok: false,
        reason: 'SERVER_ERROR',
        message: err.message || 'Internal server error',
        error: isDev ? err.stack : undefined
    });
});

const SessionJobs = require('./jobs/sessionJobs');

/**
 * Start the server
 */
async function startServer() {
    try {
        // Setup data directories
        setupDataDirectories();

        // Test database connection
        await prisma.$connect();
        console.log('âœ… Database connected');

        // Start session scanner
        SessionJobs.startScanner();

        // Start listening
        app.listen(PORT, () => {
            console.log('');
            console.log('ðŸ‹ï¸ Gym Management System Backend');
            console.log('================================');
            console.log(`ðŸš€ Server running on http://localhost:${PORT}`);
            console.log(`ðŸ”— API Base: http://localhost:${PORT}/api`);
            console.log(`ðŸ“ Data path: ${USER_DATA_PATH}`);
            console.log(`ðŸ”§ Environment: ${isDev ? 'development' : 'production'}`);
            console.log('');
        });

    } catch (error) {
        console.error('âŒ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nðŸ‘‹ Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nðŸ‘‹ Shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;

