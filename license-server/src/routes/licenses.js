/**
 * ============================================
 * LICENSE ROUTES
 * ============================================
 *
 * Public endpoints for license activation, validation,
 * heartbeat, and integrity workflows.
 */

const express = require('express');
const router = express.Router();
const { LicenseModel } = require('../database');
const { getPublicKeyBundle, signToken } = require('../security/jwt');

const DEFAULT_VALIDATE_INTERVAL_HOURS = Number.parseInt(process.env.LICENSE_VALIDATE_INTERVAL_HOURS || '24', 10);
const DEFAULT_OFFLINE_GRACE_HOURS = Number.parseInt(process.env.LICENSE_OFFLINE_GRACE_HOURS || '72', 10);

function getRequestIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
}

function getDeviceInfo(req) {
    const body = req.body || {};
    return {
        deviceName: body.deviceName || body.device_name || req.headers['x-device-name'] || null,
        platform: body.platform || req.headers['x-platform'] || null
    };
}

function issueActivationToken({ license, fingerprint, device, appVersion }) {
    return signToken(
        {
            typ: 'activation',
            licenseKey: license.license_key,
            licenseId: license.id,
            fingerprint,
            deviceId: device?.id || null,
            deviceStatus: device?.status || 'approved',
            appVersion: appVersion || null,
            gymName: license.gym_name || null,
            type: license.type,
            maxMembers: license.max_members,
            expiresAt: license.expires_at || null,
            deviceLimit: license.device_limit || 1
        },
        { expiresIn: '90d' }
    );
}

function mapValidationStatus(code) {
    if (code === 'NOT_FOUND') return 404;
    if (code === 'DEVICE_NOT_APPROVED') return 403;
    if (code === 'LICENSE_REVOKED') return 403;
    if (code === 'EXPIRED') return 403;
    if (code === 'SUSPENDED') return 403;
    if (code === 'NOT_ACTIVATED') return 403;
    return 400;
}

function ensureLicense(licenseKey) {
    const license = LicenseModel.findByKey(licenseKey);
    if (!license) {
        return null;
    }
    return {
        ...license,
        device_limit: Number.isInteger(license.device_limit) ? license.device_limit : 1
    };
}

// --------------------------------------------
// Public utility endpoints
// --------------------------------------------

router.get('/public-key', (req, res) => {
    const bundle = getPublicKeyBundle();
    res.json({
        success: true,
        ...bundle
    });
});

/**
 * POST /api/licenses/activate
 * Activate key and bind/validate device fingerprint.
 */
router.post('/activate', (req, res) => {
    try {
        const { licenseKey, deviceFingerprint, hardwareId, gymName, appVersion } = req.body;
        const fingerprint = deviceFingerprint || hardwareId;

        if (!licenseKey || !fingerprint || !gymName) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAMS',
                message: 'licenseKey, deviceFingerprint, and gymName are required'
            });
        }

        const license = ensureLicense(licenseKey);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'Invalid license key'
            });
        }

        if (license.status === 'suspended') {
            return res.status(403).json({
                success: false,
                code: 'SUSPENDED',
                message: 'License has been suspended'
            });
        }

        if (license.status === 'revoked') {
            return res.status(403).json({
                success: false,
                code: 'LICENSE_REVOKED',
                message: 'License has been revoked'
            });
        }

        if (license.expires_at && new Date(license.expires_at) < new Date()) {
            return res.status(403).json({
                success: false,
                code: 'EXPIRED',
                message: 'License has expired'
            });
        }

        const ipAddress = getRequestIp(req);
        const { deviceName, platform } = getDeviceInfo(req);
        const existingDevice = LicenseModel.findDeviceByFingerprint(license.id, fingerprint);

        if (existingDevice && existingDevice.status === 'approved') {
            LicenseModel.activateLicense({ licenseId: license.id, fingerprint, gymName });
            const seenDevice = LicenseModel.recordDeviceSeen({
                licenseId: license.id,
                fingerprint,
                deviceName,
                platform,
                appVersion,
                ipAddress,
                status: 'approved'
            });

            LicenseModel.logActivity(license.id, 'ACTIVATION_CONFIRMED', fingerprint, ipAddress, {
                appVersion,
                deviceName,
                platform,
                reason: 'already_approved'
            }, seenDevice?.id || null);

            const token = issueActivationToken({
                license: ensureLicense(licenseKey),
                fingerprint,
                device: seenDevice,
                appVersion
            });

            return res.json({
                success: true,
                message: 'License activated successfully',
                code: 'ACTIVATED',
                license: {
                    type: license.type,
                    maxMembers: license.max_members,
                    expiresAt: license.expires_at,
                    gymName: license.gym_name || gymName,
                    deviceLimit: license.device_limit || 1
                },
                activationToken: token,
                validateIntervalHours: DEFAULT_VALIDATE_INTERVAL_HOURS,
                offlineGraceHours: DEFAULT_OFFLINE_GRACE_HOURS
            });
        }

        const approvedCount = LicenseModel.countApprovedDevices(license.id);

        if (approvedCount === 0) {
            LicenseModel.activateLicense({ licenseId: license.id, fingerprint, gymName });
            const firstDevice = LicenseModel.recordDeviceSeen({
                licenseId: license.id,
                fingerprint,
                deviceName,
                platform,
                appVersion,
                ipAddress,
                status: 'approved'
            });

            LicenseModel.logActivity(license.id, 'ACTIVATED', fingerprint, ipAddress, {
                gymName,
                appVersion,
                deviceName,
                platform,
                firstActivation: true
            }, firstDevice?.id || null);

            const token = issueActivationToken({
                license: ensureLicense(licenseKey),
                fingerprint,
                device: firstDevice,
                appVersion
            });

            return res.json({
                success: true,
                message: 'License activated successfully',
                code: 'ACTIVATED',
                license: {
                    type: license.type,
                    maxMembers: license.max_members,
                    expiresAt: license.expires_at,
                    gymName: license.gym_name || gymName,
                    deviceLimit: license.device_limit || 1
                },
                activationToken: token,
                validateIntervalHours: DEFAULT_VALIDATE_INTERVAL_HOURS,
                offlineGraceHours: DEFAULT_OFFLINE_GRACE_HOURS
            });
        }

        const pendingDevice = LicenseModel.recordDeviceSeen({
            licenseId: license.id,
            fingerprint,
            deviceName,
            platform,
            appVersion,
            ipAddress,
            status: 'blocked'
        });

        LicenseModel.logActivity(license.id, 'ACTIVATION_BLOCKED_DEVICE_NOT_APPROVED', fingerprint, ipAddress, {
            appVersion,
            deviceName,
            platform,
            approvedCount,
            deviceLimit: license.device_limit || 1
        }, pendingDevice?.id || null);

        return res.status(403).json({
            success: false,
            code: 'DEVICE_NOT_APPROVED',
            message: 'Device is not approved for this license',
            deviceId: pendingDevice?.id || null,
            deviceLimit: license.device_limit || 1,
            approvedCount
        });
    } catch (error) {
        console.error('Activation error:', error);
        return res.status(500).json({
            success: false,
            code: 'ACTIVATION_ERROR',
            message: 'Server error during activation'
        });
    }
});

/**
 * POST /api/licenses/validate
 * Validate license + device fingerprint and update last seen.
 */
router.post('/validate', (req, res) => {
    try {
        const { licenseKey, deviceFingerprint, hardwareId, appVersion } = req.body;
        const fingerprint = deviceFingerprint || hardwareId;

        if (!licenseKey || !fingerprint) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_PARAMS',
                message: 'licenseKey and deviceFingerprint are required'
            });
        }

        const ipAddress = getRequestIp(req);
        const validation = LicenseModel.validate({
            key: licenseKey,
            fingerprint,
            appVersion,
            ipAddress,
            ...getDeviceInfo(req)
        });

        const license = LicenseModel.findByKey(licenseKey);
        if (license) {
            LicenseModel.logActivity(
                license.id,
                validation.valid ? 'VALIDATED' : 'VALIDATION_FAILED',
                fingerprint,
                ipAddress,
                {
                    code: validation.code || 'VALID',
                    appVersion
                },
                validation.device?.id || null
            );
        }

        if (!validation.valid) {
            return res.status(mapValidationStatus(validation.code)).json({
                success: false,
                valid: false,
                code: validation.code,
                message: validation.message
            });
        }

        const refreshedLicense = ensureLicense(licenseKey);
        const token = issueActivationToken({
            license: refreshedLicense,
            fingerprint,
            device: validation.device,
            appVersion
        });

        return res.json({
            success: true,
            valid: true,
            code: 'VALID',
            license: {
                type: refreshedLicense.type,
                gymName: refreshedLicense.gym_name,
                maxMembers: refreshedLicense.max_members,
                expiresAt: refreshedLicense.expires_at,
                deviceLimit: refreshedLicense.device_limit || 1,
                status: refreshedLicense.status
            },
            device: {
                id: validation.device?.id || null,
                status: validation.device?.status || 'approved',
                lastSeenAt: validation.device?.last_seen_at || null
            },
            activationToken: token,
            validateIntervalHours: DEFAULT_VALIDATE_INTERVAL_HOURS,
            offlineGraceHours: DEFAULT_OFFLINE_GRACE_HOURS,
            nextCheckRequired: new Date(Date.now() + DEFAULT_VALIDATE_INTERVAL_HOURS * 60 * 60 * 1000).toISOString()
        });
    } catch (error) {
        console.error('Validation error:', error);
        return res.status(500).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Server error during validation'
        });
    }
});

/**
 * POST /api/licenses/heartbeat
 * Lightweight online ping that updates device lastSeen metadata.
 */
router.post('/heartbeat', (req, res) => {
    try {
        const { licenseKey, deviceFingerprint, hardwareId, appVersion } = req.body;
        const fingerprint = deviceFingerprint || hardwareId;

        if (!licenseKey || !fingerprint) {
            return res.status(400).json({
                success: false,
                valid: false,
                code: 'MISSING_PARAMS',
                message: 'licenseKey and deviceFingerprint are required'
            });
        }

        const ipAddress = getRequestIp(req);
        const validation = LicenseModel.validate({
            key: licenseKey,
            fingerprint,
            appVersion,
            ipAddress,
            ...getDeviceInfo(req)
        });

        const license = LicenseModel.findByKey(licenseKey);
        if (license) {
            LicenseModel.logActivity(
                license.id,
                validation.valid ? 'HEARTBEAT' : 'HEARTBEAT_FAILED',
                fingerprint,
                ipAddress,
                {
                    code: validation.code || 'VALID',
                    appVersion
                },
                validation.device?.id || null
            );
        }

        if (!validation.valid) {
            return res.status(mapValidationStatus(validation.code)).json({
                success: false,
                valid: false,
                code: validation.code,
                message: validation.message
            });
        }

        return res.json({
            success: true,
            valid: true,
            code: 'HEARTBEAT_OK',
            lastSeenAt: validation.device?.last_seen_at || null
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
        return res.status(500).json({
            success: false,
            valid: false,
            code: 'HEARTBEAT_ERROR',
            message: 'Server error during heartbeat'
        });
    }
});

/**
 * GET /api/licenses/status/:key
 * Quick status check.
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

        return res.json({
            success: true,
            status: license.status,
            type: license.type,
            expiresAt: license.expires_at,
            deviceLimit: license.device_limit || 1
        });
    } catch (error) {
        console.error('Status check error:', error);
        return res.status(500).json({
            success: false,
            code: 'STATUS_ERROR',
            message: 'Server error'
        });
    }
});

module.exports = router;
