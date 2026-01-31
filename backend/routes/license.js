/**
 * ============================================
 * LICENSE ROUTES
 * ============================================
 * 
 * API endpoints for license management in the gym app.
 * Connects to the license server for validation.
 */

const express = require('express');
const router = express.Router();
const licenseService = require('../services/licenseService');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /api/license/status
 * Get current license status (public - for initial check)
 * ALWAYS returns 200 with valid/invalid status. Never 500 for expected cases.
 */
router.get('/status', async (req, res) => {
    try {
        const status = await licenseService.getStatus();

        // Always return 200 - the status object contains valid: true/false
        res.json({
            success: true,
            data: {
                licensed: Boolean(status?.valid),
                ...status
            }
        });

    } catch (error) {
        // Fail-safe: never block UI with a 500 on license status
        console.error('License status unexpected error:', error);
        res.json({
            success: false,
            data: {
                valid: false,
                status: 'error',
                message: 'Unexpected error checking license status'
            },
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/license/hardware-id
 * Get hardware ID for this machine
 */
router.get('/hardware-id', (req, res) => {
    try {
        const hardwareId = licenseService.getHardwareId();
        const hasHardwareId = typeof hardwareId === 'string' && hardwareId.length > 0;
        const displayHardwareId = hasHardwareId ? `${hardwareId.slice(0, 16)}...` : null;

        res.json({
            success: hasHardwareId,
            data: {
                hardwareId: displayHardwareId
            },
            message: hasHardwareId ? undefined : 'Failed to generate hardware ID'
        });

    } catch (error) {
        console.error('Hardware ID error:', error);
        res.json({
            success: false,
            data: { hardwareId: null },
            message: 'Failed to generate hardware ID'
        });
    }
});

/**
 * POST /api/license/activate
 * Activate a license key
 */
router.post('/activate', async (req, res) => {
    try {
        const { licenseKey, gymName } = req.body;

        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                message: 'License key is required'
            });
        }

        const result = await licenseService.activate(licenseKey, gymName);

        if (result.success) {
            return res.json({
                success: true,
                message: 'License activated successfully',
                data: result.license
            });
        }

        // Map error codes to HTTP status codes
        let httpStatus = 400;
        if (result.code === 'NETWORK_ERROR') {
            httpStatus = 200; // Keep client flow stable; still return success: false
        } else if (result.code === 'HARDWARE_MISMATCH') {
            httpStatus = 409; // Conflict
        } else if (result.code === 'EXPIRED' || result.code === 'INVALID' || result.code === 'REVOKED') {
            httpStatus = 403; // Forbidden
        }

        return res.status(httpStatus).json({
            success: false,
            code: result.code,
            message: result.message
        });

    } catch (error) {
        console.error('Activation unexpected error:', error);
        res.status(200).json({
            success: false,
            code: 'UNEXPECTED_ERROR',
            message: 'Unexpected error during activation',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/license/validate
 * Validate current license
 */
router.post('/validate', async (req, res) => {
    try {
        const { licenseKey } = req.body;

        const result = await licenseService.validate(licenseKey);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Validation error:', error);
        res.json({
            success: false,
            data: {
                valid: false,
                code: 'VALIDATION_ERROR',
                message: 'Failed to validate license'
            }
        });
    }
});

/**
 * DELETE /api/license/cache
 * Clear license cache (admin only - for troubleshooting)
 */
router.delete('/cache', authenticate, authorize('admin'), (req, res) => {
    try {
        const cleared = licenseService.clearCache();

        res.json({
            success: true,
            message: cleared ? 'Cache cleared' : 'No cache to clear'
        });

    } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear cache'
        });
    }
});

module.exports = router;
