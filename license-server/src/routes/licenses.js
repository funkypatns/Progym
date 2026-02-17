/**
 * ============================================
 * LICENSE ROUTES
 * ============================================
 *
 * Public and protected endpoints for license activation,
 * validation, device management, and integrity manifests.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { LicenseModel, getAll, getOne, run } = require('../database');
const { getPublicKeyBundle, signToken } = require('../security/jwt');
const { getManifestForVersion, signManifestPayload } = require('../security/manifest');

const ADMIN_TOKEN = process.env.LICENSE_ADMIN_TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || 'license-secret';
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

function authenticateAdmin(req, res, next) {
    const headerToken = req.headers['x-license-admin-token'];
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const providedToken = headerToken || bearerToken;

    if (ADMIN_TOKEN && providedToken === ADMIN_TOKEN) {
        req.licenseAdmin = { mode: 'token' };
        return next();
    }

    if (bearerToken) {
        try {
            const decoded = jwt.verify(bearerToken, JWT_SECRET);
            if (decoded?.role === 'admin' || decoded?.role === 'superadmin') {
                req.licenseAdmin = { mode: 'jwt', admin: decoded };
                return next();
            }
        } catch (_) {
            // fall through to 401
        }
    }

    return res.status(401).json({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Admin authorization required'
    });
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

router.get('/manifest/:appVersion', (req, res) => {
    const appVersion = req.params.appVersion;
    const licenseKey = req.query.licenseKey;
    const fingerprint = req.query.deviceFingerprint;

    if (!licenseKey || !fingerprint) {
        return res.status(400).json({
            success: false,
            code: 'MISSING_PARAMS',
            message: 'licenseKey and deviceFingerprint are required'
        });
    }

    const validation = LicenseModel.validate({
        key: licenseKey,
        fingerprint,
        appVersion,
        ipAddress: getRequestIp(req),
        ...getDeviceInfo(req)
    });

    if (!validation.valid) {
        return res.status(mapValidationStatus(validation.code)).json({
            success: false,
            code: validation.code,
            message: validation.message
        });
    }

    const manifest = getManifestForVersion(appVersion);
    if (!manifest) {
        return res.status(404).json({
            success: false,
            code: 'MANIFEST_NOT_FOUND',
            message: `No integrity manifest found for appVersion ${appVersion}`
        });
    }

    const signed = signManifestPayload(manifest);
    return res.json({
        success: true,
        ...signed
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

// --------------------------------------------
// Protected device management endpoints
// --------------------------------------------

router.get('/', authenticateAdmin, (req, res) => {
    try {
        const licenses = LicenseModel.listAllLicensesWithCounts();
        return res.json({
            success: true,
            data: licenses.map((lic) => ({
                id: lic.id,
                key: lic.license_key,
                status: lic.status,
                type: lic.type,
                ownerName: lic.owner_name,
                ownerEmail: lic.owner_email,
                gymName: lic.gym_name,
                maxMembers: lic.max_members,
                deviceLimit: lic.device_limit || 1,
                approvedDevices: lic.approved_devices || 0,
                totalDevices: lic.total_devices || 0,
                expiresAt: lic.expires_at,
                activatedAt: lic.activated_at,
                lastSeenAt: lic.last_seen_at,
                lastSeenIp: lic.last_seen_ip,
                appVersion: lic.app_version,
                createdAt: lic.created_at
            }))
        });
    } catch (error) {
        console.error('List licenses error:', error);
        return res.status(500).json({
            success: false,
            code: 'LIST_LICENSES_ERROR',
            message: 'Failed to list licenses'
        });
    }
});

router.get('/:key/devices', authenticateAdmin, (req, res) => {
    try {
        const license = ensureLicense(req.params.key);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'License not found'
            });
        }

        const devices = LicenseModel.listDevicesByKey(req.params.key);
        return res.json({
            success: true,
            data: devices.map((device) => ({
                id: device.id,
                licenseKey: device.license_key,
                fingerprint: device.fingerprint,
                deviceName: device.device_name,
                platform: device.platform,
                appVersion: device.app_version,
                firstActivatedAt: device.first_activated_at,
                lastSeenAt: device.last_seen_at,
                lastSeenIp: device.last_seen_ip,
                status: device.status
            }))
        });
    } catch (error) {
        console.error('List devices error:', error);
        return res.status(500).json({
            success: false,
            code: 'LIST_DEVICES_ERROR',
            message: 'Failed to list devices'
        });
    }
});

router.post('/:key/devices/:deviceId/approve', authenticateAdmin, (req, res) => {
    try {
        const license = ensureLicense(req.params.key);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'License not found'
            });
        }

        const deviceId = Number.parseInt(req.params.deviceId, 10);
        const target = getOne('SELECT * FROM license_devices WHERE id = ? AND license_id = ?', [deviceId, license.id]);
        if (!target) {
            return res.status(404).json({
                success: false,
                code: 'DEVICE_NOT_FOUND',
                message: 'Device not found'
            });
        }

        const approvedDevices = getAll(
            "SELECT * FROM license_devices WHERE license_id = ? AND status = 'approved' ORDER BY datetime(last_seen_at) ASC, datetime(first_activated_at) ASC",
            [license.id]
        );

        const limit = Math.max(1, Number.parseInt(String(license.device_limit || 1), 10) || 1);
        const needsSlot = target.status !== 'approved' ? 1 : 0;
        const overflow = Math.max(0, approvedDevices.length + needsSlot - limit);

        for (let i = 0; i < overflow; i += 1) {
            const victim = approvedDevices[i];
            if (!victim || victim.id === target.id) {
                continue;
            }
            LicenseModel.setDeviceStatus(victim.id, 'revoked');
            LicenseModel.logActivity(license.id, 'DEVICE_AUTO_REVOKED_FOR_LIMIT', victim.fingerprint, getRequestIp(req), {
                reason: 'device_limit_enforced_on_approve',
                approvedByDeviceId: target.id,
                limit
            }, victim.id);
        }

        LicenseModel.setDeviceStatus(target.id, 'approved');
        LicenseModel.logActivity(license.id, 'DEVICE_APPROVED', target.fingerprint, getRequestIp(req), {
            limit
        }, target.id);

        return res.json({
            success: true,
            message: 'Device approved'
        });
    } catch (error) {
        console.error('Approve device error:', error);
        return res.status(500).json({
            success: false,
            code: 'APPROVE_DEVICE_ERROR',
            message: 'Failed to approve device'
        });
    }
});

router.post('/:key/devices/:deviceId/revoke', authenticateAdmin, (req, res) => {
    try {
        const license = ensureLicense(req.params.key);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'License not found'
            });
        }

        const deviceId = Number.parseInt(req.params.deviceId, 10);
        const target = getOne('SELECT * FROM license_devices WHERE id = ? AND license_id = ?', [deviceId, license.id]);
        if (!target) {
            return res.status(404).json({
                success: false,
                code: 'DEVICE_NOT_FOUND',
                message: 'Device not found'
            });
        }

        LicenseModel.setDeviceStatus(deviceId, 'revoked');
        LicenseModel.logActivity(license.id, 'DEVICE_REVOKED', target.fingerprint, getRequestIp(req), {
            reason: req.body?.reason || null
        }, target.id);

        return res.json({
            success: true,
            message: 'Device revoked'
        });
    } catch (error) {
        console.error('Revoke device error:', error);
        return res.status(500).json({
            success: false,
            code: 'REVOKE_DEVICE_ERROR',
            message: 'Failed to revoke device'
        });
    }
});

router.post('/:key/reset-devices', authenticateAdmin, (req, res) => {
    try {
        const license = ensureLicense(req.params.key);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'License not found'
            });
        }

        const changed = LicenseModel.resetDevicesByKey(req.params.key);
        LicenseModel.logActivity(license.id, 'DEVICES_RESET', null, getRequestIp(req), {
            changed
        });

        return res.json({
            success: true,
            message: 'License devices reset',
            changed
        });
    } catch (error) {
        console.error('Reset devices error:', error);
        return res.status(500).json({
            success: false,
            code: 'RESET_DEVICES_ERROR',
            message: 'Failed to reset devices'
        });
    }
});

router.patch('/:key', authenticateAdmin, (req, res) => {
    try {
        const license = ensureLicense(req.params.key);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'License not found'
            });
        }

        const allowedStatuses = ['inactive', 'active', 'expired', 'suspended', 'revoked'];
        const nextStatus = req.body?.status;
        const nextDeviceLimit = req.body?.device_limit;

        if (nextStatus && !allowedStatuses.includes(nextStatus)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_STATUS',
                message: 'Invalid status'
            });
        }

        if (nextDeviceLimit !== undefined) {
            const parsed = Number.parseInt(String(nextDeviceLimit), 10);
            if (!Number.isInteger(parsed) || parsed < 1) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_DEVICE_LIMIT',
                    message: 'device_limit must be an integer >= 1'
                });
            }
        }

        const updated = LicenseModel.patchLicenseByKey(req.params.key, {
            status: nextStatus,
            deviceLimit: nextDeviceLimit !== undefined ? Number.parseInt(String(nextDeviceLimit), 10) : undefined
        });

        if (!updated) {
            return res.status(400).json({
                success: false,
                code: 'NO_CHANGES',
                message: 'No valid changes were provided'
            });
        }

        if (nextDeviceLimit !== undefined) {
            const refreshed = ensureLicense(req.params.key);
            const limit = Math.max(1, Number.parseInt(String(refreshed.device_limit || 1), 10) || 1);
            const approved = getAll(
                "SELECT * FROM license_devices WHERE license_id = ? AND status = 'approved' ORDER BY datetime(last_seen_at) ASC, datetime(first_activated_at) ASC",
                [refreshed.id]
            );
            const overflow = Math.max(0, approved.length - limit);
            for (let i = 0; i < overflow; i += 1) {
                const device = approved[i];
                if (!device) continue;
                LicenseModel.setDeviceStatus(device.id, 'revoked');
                LicenseModel.logActivity(refreshed.id, 'DEVICE_AUTO_REVOKED_FOR_LIMIT', device.fingerprint, getRequestIp(req), {
                    reason: 'device_limit_reduced',
                    limit
                }, device.id);
            }
        }

        const refreshed = ensureLicense(req.params.key);
        LicenseModel.logActivity(refreshed.id, 'LICENSE_PATCHED', null, getRequestIp(req), {
            status: nextStatus,
            deviceLimit: nextDeviceLimit
        });

        return res.json({
            success: true,
            message: 'License updated'
        });
    } catch (error) {
        console.error('Patch license error:', error);
        return res.status(500).json({
            success: false,
            code: 'PATCH_LICENSE_ERROR',
            message: 'Failed to update license'
        });
    }
});

router.post('/:key/revoke', authenticateAdmin, (req, res) => {
    try {
        const license = ensureLicense(req.params.key);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'NOT_FOUND',
                message: 'License not found'
            });
        }

        const reason = req.body?.reason || 'revoked_by_admin';
        LicenseModel.patchLicenseByKey(req.params.key, {
            status: 'revoked',
            revokedReason: reason
        });
        const changed = LicenseModel.resetDevicesByKey(req.params.key);

        LicenseModel.logActivity(license.id, 'LICENSE_REVOKED', null, getRequestIp(req), {
            reason,
            devicesRevoked: changed
        });

        return res.json({
            success: true,
            message: 'License revoked'
        });
    } catch (error) {
        console.error('Revoke license error:', error);
        return res.status(500).json({
            success: false,
            code: 'REVOKE_LICENSE_ERROR',
            message: 'Failed to revoke license'
        });
    }
});

module.exports = router;