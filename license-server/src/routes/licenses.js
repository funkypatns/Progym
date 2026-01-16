/**
 * ============================================
 * LICENSE ROUTES
 * ============================================
 * 
 * Public endpoints for license activation and validation.
 * Used by the Gym Management System client.
 */

const express = require('express');
const router = express.Router();
const CryptoJS = require('crypto-js');
const { LicenseModel } = require('../database');

// Secret for signing responses (client should verify)
const RESPONSE_SECRET = process.env.JWT_SECRET || 'license-secret';

/**
 * Sign response to prevent tampering
 */
function signResponse(data) {
    const timestamp = Date.now();
    const payload = JSON.stringify({ ...data, timestamp });
    const signature = CryptoJS.HmacSHA256(payload, RESPONSE_SECRET).toString();
    return { ...data, timestamp, signature };
}

/**
 * POST /api/licenses/activate
 * Activate a license key and bind to hardware
 */
router.post('/activate', (req, res) => {
    try {
        const { licenseKey, hardwareId, gymName } = req.body;

        if (!licenseKey || !hardwareId) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAMS',
                message: 'License key and hardware ID are required'
            });
        }

        // Find license
        console.log(`[DEBUG] Activation Request for Key: '${licenseKey}'`);
        const license = LicenseModel.findByKey(licenseKey);
        console.log(`[DEBUG] Key Found in DB:`, license ? 'YES' : 'NO');

        if (!license) {
            console.log(`[DEBUG] License lookup failed for: '${licenseKey}'`);
            return res.status(404).json(signResponse({
                success: false,
                code: 'NOT_FOUND',
                message: 'Invalid license key'
            }));
        }

        // Check if already activated on different hardware
        if (license.hardware_id && license.hardware_id !== hardwareId) {
            LicenseModel.logActivity(license.id, 'ACTIVATION_FAILED_HARDWARE', hardwareId, req.ip, {
                reason: 'Already bound to different device'
            });

            return res.status(403).json(signResponse({
                success: false,
                code: 'HARDWARE_MISMATCH',
                message: 'License is already activated on another device'
            }));
        }

        // Check if expired
        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            return res.status(403).json(signResponse({
                success: false,
                code: 'EXPIRED',
                message: 'License has expired'
            }));
        }

        // Check if suspended
        if (license.status === 'suspended') {
            return res.status(403).json(signResponse({
                success: false,
                code: 'SUSPENDED',
                message: 'License has been suspended'
            }));
        }

        // Activate license
        const activated = LicenseModel.activate(licenseKey, hardwareId);

        if (activated) {
            console.log(`[DEBUG] Activation SUCCESS for ${licenseKey}`);
            LicenseModel.logActivity(license.id, 'ACTIVATED', hardwareId, req.ip, { gymName });

            return res.json(signResponse({
                success: true,
                message: 'License activated successfully',
                license: {
                    type: license.type,
                    maxMembers: license.max_members,
                    expiresAt: license.expires_at,
                    gymName: license.gym_name || gymName
                }
            }));
        } else {
            console.log(`[DEBUG] Activation FAILED (DB Update 0 changes) for ${licenseKey}`);
            return res.status(500).json(signResponse({
                success: false,
                code: 'ACTIVATION_FAILED',
                message: 'Failed to activate license'
            }));
        }

    } catch (error) {
        console.error('Activation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during activation'
        });
    }
});

/**
 * POST /api/licenses/validate
 * Validate an active license (periodic check)
 */
router.post('/validate', (req, res) => {
    try {
        const { licenseKey, hardwareId } = req.body;

        if (!licenseKey || !hardwareId) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAMS',
                message: 'License key and hardware ID are required'
            });
        }

        const result = LicenseModel.validate(licenseKey, hardwareId);

        // Log validation attempt
        const license = LicenseModel.findByKey(licenseKey);
        if (license) {
            LicenseModel.logActivity(
                license.id,
                result.valid ? 'VALIDATED' : 'VALIDATION_FAILED',
                hardwareId,
                req.ip,
                { code: result.code }
            );
        }

        if (result.valid) {
            return res.json(signResponse({
                success: true,
                valid: true,
                license: result.license,
                // Grace period info (client can cache this)
                gracePeriodDays: 7,
                nextCheckRequired: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            }));
        } else {
            return res.status(403).json(signResponse({
                success: false,
                valid: false,
                code: result.code,
                message: result.message
            }));
        }

    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during validation'
        });
    }
});

/**
 * GET /api/licenses/status/:key
 * Quick status check (lighter than full validation)
 */
router.get('/status/:key', (req, res) => {
    try {
        const license = LicenseModel.findByKey(req.params.key);

        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND'
            });
        }

        res.json(signResponse({
            success: true,
            status: license.status,
            type: license.type,
            expiresAt: license.expires_at
        }));

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
