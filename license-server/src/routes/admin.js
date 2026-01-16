/**
 * ============================================
 * ADMIN ROUTES
 * ============================================
 * 
 * Protected endpoints for license management.
 * Requires JWT authentication.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { LicenseModel, AdminModel, getDb, run, getOne, getAll } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'license-secret';

// ============================================
// AUTH MIDDLEWARE
// ============================================

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * POST /api/admin/login
 * Admin login
 */
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password required'
            });
        }

        const admin = AdminModel.findByUsername(username);

        if (!admin || !AdminModel.verifyPassword(password, admin.password)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: admin.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ============================================
// PROTECTED ROUTES
// ============================================

// Apply auth middleware to all routes below
router.use(authenticateAdmin);

/**
 * POST /api/admin/licenses/generate
 * Generate and create a new license (Canonical)
 */
router.post('/licenses/generate', (req, res) => {
    try {
        const { type, days, gymName, ownerName } = req.body;

        // Canonical Format: GYM-{TYPE}-{RAND4}-{RAND4}
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const rand = (len) => Array.from({ length: len }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');

        let typeCode = 'STD';
        let durationDays = 30;

        // Map type to code and duration
        if (type === 'MONTH') { typeCode = 'MONTH'; durationDays = 30; }
        else if (type === 'YEAR') { typeCode = 'YEAR'; durationDays = 365; }
        else if (type === 'VIP') { typeCode = 'VIP'; durationDays = 36500; }
        else if (type === 'CUSTOM') { typeCode = `DAYS${days}`; durationDays = parseInt(days) || 30; }
        else { typeCode = 'STD'; durationDays = 30; }

        const licenseKey = `GYM-${typeCode}-${rand(4)}-${rand(4)}`;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + durationDays);

        const result = LicenseModel.create({
            type: type || 'standard',
            ownerName: ownerName || 'Generated User',
            gymName: gymName || 'Generated License',
            maxMembers: 1000,
            expiresAt: expiresAt.toISOString(),
            licenseKey: licenseKey
        });

        res.status(201).json({
            success: true,
            message: 'License generated successfully',
            data: {
                id: result.id,
                key: result.key,
                expiresAt: expiresAt.toISOString()
            }
        });

    } catch (error) {
        console.error('Generate license error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * GET /api/admin/licenses
 * List all licenses
 */
router.get('/licenses', (req, res) => {
    try {
        const licenses = LicenseModel.findAll();

        res.json({
            success: true,
            data: licenses.map(lic => ({
                id: lic.id,
                key: lic.license_key,
                status: lic.status,
                type: lic.type,
                ownerName: lic.owner_name,
                ownerEmail: lic.owner_email,
                gymName: lic.gym_name,
                maxMembers: lic.max_members,
                hardwareId: lic.hardware_id ? `${lic.hardware_id.substring(0, 8)}...` : null,
                expiresAt: lic.expires_at,
                activatedAt: lic.activated_at,
                lastChecked: lic.last_checked,
                createdAt: lic.created_at
            }))
        });

    } catch (error) {
        console.error('List licenses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * POST /api/admin/licenses
 * Create a new license
 */
router.post('/licenses', (req, res) => {
    try {
        const { type, ownerName, ownerEmail, gymName, maxMembers, expiresAt, licenseKey } = req.body;
        console.log('[DEBUG] Creating license with body:', JSON.stringify(req.body, null, 2));

        const result = LicenseModel.create({
            type: type || 'standard',
            ownerName,
            ownerEmail,
            gymName,
            maxMembers: maxMembers || 100,
            expiresAt,
            licenseKey
        });

        res.status(201).json({
            success: true,
            message: 'License created successfully',
            data: {
                id: result.id,
                key: result.key
            }
        });

    } catch (error) {
        console.error('Create license error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * PUT /api/admin/licenses/:id/status
 * Update license status (activate, suspend, etc.)
 */
router.put('/licenses/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        const licenseId = parseInt(req.params.id);

        if (!['inactive', 'active', 'expired', 'suspended'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const updated = LicenseModel.updateStatus(licenseId, status);

        if (updated) {
            res.json({
                success: true,
                message: `License status updated to ${status}`
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'License not found'
            });
        }

    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * DELETE /api/admin/licenses/:id
 * Revoke/Delete a license
 */
router.delete('/licenses/:id', (req, res) => {
    try {
        const licenseId = parseInt(req.params.id);

        // Delete logs first (foreign key)
        run('DELETE FROM license_logs WHERE license_id = ?', [licenseId]);

        // Delete license
        const result = run('DELETE FROM licenses WHERE id = ?', [licenseId]);

        if (result.changes > 0) {
            res.json({
                success: true,
                message: 'License deleted'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'License not found'
            });
        }

    } catch (error) {
        console.error('Delete license error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});


/**
 * GET /api/admin/licenses/:id/logs
 * Get activity logs for a license
 */
router.get('/licenses/:id/logs', (req, res) => {
    try {
        const licenseId = parseInt(req.params.id);

        const logs = getAll(`
            SELECT * FROM license_logs 
            WHERE license_id = ? 
            ORDER BY created_at DESC 
            LIMIT 100
        `, [licenseId]);

        res.json({
            success: true,
            data: logs.map(log => ({
                ...log,
                details: log.details ? JSON.parse(log.details) : null
            }))
        });

    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

/**
 * GET /api/admin/stats
 * Dashboard statistics
 */
router.get('/stats', (req, res) => {
    try {
        const total = getOne('SELECT COUNT(*) as count FROM licenses')?.count || 0;
        const active = getOne("SELECT COUNT(*) as count FROM licenses WHERE status = 'active'")?.count || 0;
        const expired = getOne("SELECT COUNT(*) as count FROM licenses WHERE status = 'expired'")?.count || 0;
        const suspended = getOne("SELECT COUNT(*) as count FROM licenses WHERE status = 'suspended'")?.count || 0;

        const recentActivations = getAll(`
            SELECT * FROM licenses 
            WHERE activated_at IS NOT NULL 
            ORDER BY activated_at DESC 
            LIMIT 5
        `);

        res.json({
            success: true,
            data: {
                total,
                active,
                expired,
                suspended,
                recentActivations: recentActivations.map(lic => ({
                    key: lic.license_key,
                    gymName: lic.gym_name,
                    activatedAt: lic.activated_at
                }))
            }
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
