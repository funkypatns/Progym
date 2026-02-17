/**
 * ============================================
 * LICENSE ROUTES
 * ============================================
 *
 * API endpoints for license management in the gym app.
 * Connects to the license server for activation, validation, and heartbeat.
 */

const express = require('express');
const router = express.Router();
const licenseService = require('../services/licenseService');

function mapActivationCodeToStatus(code) {
    if (code === 'NETWORK_ERROR') return 503;
    if (code === 'DEVICE_NOT_APPROVED') return 403;
    if (code === 'LICENSE_REVOKED') return 403;
    if (typeof code === 'string' && code.startsWith('INTEGRITY_')) return 403;
    if (code === 'MANIFEST_INVALID' || code === 'UNSUPPORTED_HASH_ALGORITHM') return 403;
    if (code === 'EXPIRED') return 403;
    if (code === 'INVALID_KEY' || code === 'INVALID_KEY_FORMAT' || code === 'GYM_NAME_REQUIRED') return 400;
    if (code === 'NOT_FOUND') return 404;
    if (code === 'UNAUTHORIZED') return 401;
    if (code === 'SUSPENDED') return 403;
    return 400;
}

/**
 * GET /api/license/status
 * Get current license status (public - for initial check)
 */
router.get('/status', async (req, res) => {
    try {
        const status = await licenseService.getStatus();
        return res.json({
            success: true,
            data: {
                licensed: Boolean(status?.valid),
                ...status
            }
        });
    } catch (error) {
        console.error('License status unexpected error:', error);
        return res.json({
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
 * Get masked fingerprint for support display.
 */
router.get('/hardware-id', (req, res) => {
    try {
        const fingerprint = licenseService.getDeviceFingerprint();
        const displayFingerprint = fingerprint ? `${fingerprint.slice(0, 12)}...${fingerprint.slice(-6)}` : null;

        return res.json({
            success: Boolean(fingerprint),
            data: {
                hardwareId: displayFingerprint,
                deviceFingerprint: displayFingerprint
            },
            message: fingerprint ? undefined : 'Failed to generate device fingerprint'
        });
    } catch (error) {
        console.error('Hardware ID error:', error);
        return res.json({
            success: false,
            data: { hardwareId: null, deviceFingerprint: null },
            message: 'Failed to generate device fingerprint'
        });
    }
});

/**
 * POST /api/license/activate
 * Activate a license key.
 */
router.post('/activate', async (req, res) => {
    try {
        const { licenseKey, gymName } = req.body;
        const trimmedKey = typeof licenseKey === 'string' ? licenseKey.trim() : '';
        const trimmedGymName = typeof gymName === 'string' ? gymName.trim() : '';

        if (!trimmedKey) {
            return res.status(400).json({
                success: false,
                message: 'License key is required',
                errorCode: 'INVALID_KEY',
                code: 'INVALID_KEY'
            });
        }

        const keyFormatOk = /^[A-Za-z0-9-]{8,}$/.test(trimmedKey);
        if (!keyFormatOk) {
            return res.status(400).json({
                success: false,
                message: 'Invalid license key format',
                errorCode: 'INVALID_KEY_FORMAT',
                code: 'INVALID_KEY_FORMAT'
            });
        }

        if (!trimmedGymName) {
            return res.status(400).json({
                success: false,
                message: 'gymName is required',
                errorCode: 'GYM_NAME_REQUIRED',
                code: 'GYM_NAME_REQUIRED'
            });
        }

        const result = await licenseService.activate(trimmedKey, trimmedGymName);

        if (result.success) {
            return res.json({
                success: true,
                message: 'License activated successfully',
                data: result.license
            });
        }

        return res.status(mapActivationCodeToStatus(result.code)).json({
            success: false,
            message: result.message || 'Activation failed',
            errorCode: result.code || 'ACTIVATION_FAILED',
            code: result.code || 'ACTIVATION_FAILED'
        });
    } catch (error) {
        console.error('Activation unexpected error:', error);
        return res.status(500).json({
            success: false,
            errorCode: 'UNEXPECTED_ERROR',
            code: 'UNEXPECTED_ERROR',
            message: 'Unexpected error during activation'
        });
    }
});

/**
 * POST /api/license/validate
 * Validate current license (forced online when available).
 */
router.post('/validate', async (req, res) => {
    try {
        const { licenseKey, forceOnline } = req.body || {};
        const result = await licenseService.validate(licenseKey, {
            forceOnline: forceOnline !== false
        });

        return res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('Validation error:', error);
        return res.json({
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
 * POST /api/license/heartbeat
 * Send heartbeat to license server to refresh lastSeen metadata.
 */
router.post('/heartbeat', async (req, res) => {
    try {
        const { licenseKey } = req.body || {};
        const heartbeat = await licenseService.heartbeat(licenseKey);
        return res.json({
            success: true,
            data: heartbeat
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        return res.status(400).json({
            success: false,
            code: 'HEARTBEAT_ERROR',
            message: error.message || 'Failed to send heartbeat'
        });
    }
});

module.exports = router;
