/**
 * ============================================
 * LICENSE ROUTES
 * ============================================
 *
 * API endpoints for license management in the gym app.
 * Connects to the license server for validation and device management.
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const licenseService = require('../services/licenseService');
const { authenticate, authorize } = require('../middleware/auth');

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:4000';
const LICENSE_ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || '';

function mapActivationCodeToStatus(code) {
    if (code === 'NETWORK_ERROR') return 503;
    if (code === 'DEVICE_NOT_APPROVED') return 403;
    if (code === 'LICENSE_REVOKED') return 403;
    if (code === 'EXPIRED') return 403;
    if (code === 'INVALID_KEY' || code === 'INVALID_KEY_FORMAT' || code === 'GYM_NAME_REQUIRED') return 400;
    if (code === 'NOT_FOUND') return 404;
    if (code === 'UNAUTHORIZED') return 401;
    if (code === 'SUSPENDED') return 403;
    return 400;
}

async function proxyAdminRequest({ method, endpoint, data, params, authHeader }) {
    const headers = {};

    if (LICENSE_ADMIN_TOKEN) {
        headers['x-license-admin-token'] = LICENSE_ADMIN_TOKEN;
    } else if (authHeader) {
        headers.Authorization = authHeader;
    }

    const response = await axios({
        method,
        url: `${LICENSE_SERVER_URL}${endpoint}`,
        data,
        params,
        headers,
        timeout: 10000
    });

    return response.data;
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
 * DELETE /api/license/cache
 * Clear license cache (admin only - troubleshooting)
 */
router.delete('/cache', authenticate, authorize('admin'), (req, res) => {
    try {
        const cleared = licenseService.clearCache();
        return res.json({
            success: true,
            message: cleared ? 'Cache cleared' : 'No cache to clear'
        });
    } catch (error) {
        console.error('Clear cache error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to clear cache'
        });
    }
});

/**
 * GET /api/licenses
 * Admin: list all licenses and device usage.
 */
router.get('/licenses', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'GET',
            endpoint: '/api/licenses',
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'LICENSES_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to fetch licenses'
        });
    }
});

/**
 * GET /api/licenses/:key/devices
 */
router.get('/licenses/:key/devices', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'GET',
            endpoint: `/api/licenses/${encodeURIComponent(req.params.key)}/devices`,
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'LICENSE_DEVICES_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to fetch devices'
        });
    }
});

/**
 * POST /api/licenses/:key/devices/:deviceId/approve
 */
router.post('/licenses/:key/devices/:deviceId/approve', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'POST',
            endpoint: `/api/licenses/${encodeURIComponent(req.params.key)}/devices/${encodeURIComponent(req.params.deviceId)}/approve`,
            data: req.body || {},
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'APPROVE_DEVICE_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to approve device'
        });
    }
});

/**
 * POST /api/licenses/:key/devices/:deviceId/revoke
 */
router.post('/licenses/:key/devices/:deviceId/revoke', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'POST',
            endpoint: `/api/licenses/${encodeURIComponent(req.params.key)}/devices/${encodeURIComponent(req.params.deviceId)}/revoke`,
            data: req.body || {},
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'REVOKE_DEVICE_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to revoke device'
        });
    }
});

/**
 * POST /api/licenses/:key/reset-devices
 */
router.post('/licenses/:key/reset-devices', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'POST',
            endpoint: `/api/licenses/${encodeURIComponent(req.params.key)}/reset-devices`,
            data: req.body || {},
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'RESET_DEVICES_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to reset devices'
        });
    }
});

/**
 * PATCH /api/licenses/:key
 */
router.patch('/licenses/:key', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'PATCH',
            endpoint: `/api/licenses/${encodeURIComponent(req.params.key)}`,
            data: req.body || {},
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'PATCH_LICENSE_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to update license'
        });
    }
});

/**
 * POST /api/licenses/:key/revoke
 */
router.post('/licenses/:key/revoke', authenticate, authorize('admin'), async (req, res) => {
    try {
        const payload = await proxyAdminRequest({
            method: 'POST',
            endpoint: `/api/licenses/${encodeURIComponent(req.params.key)}/revoke`,
            data: req.body || {},
            authHeader: req.headers.authorization
        });
        return res.json(payload);
    } catch (error) {
        return res.status(error.response?.status || 500).json({
            success: false,
            code: error.response?.data?.code || 'REVOKE_LICENSE_PROXY_ERROR',
            message: error.response?.data?.message || 'Failed to revoke license'
        });
    }
});

module.exports = router;