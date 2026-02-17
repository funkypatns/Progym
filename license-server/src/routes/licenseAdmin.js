const express = require('express');
const path = require('path');
const { AdminModel, LicenseModel, VendorProfileModel, getAll, getOne } = require('../database');
const {
    issueLicenseAdminToken,
    requireLicenseAdminAuth
} = require('../security/licenseAdminAuth');

const router = express.Router();
const ADMIN_UI_DIR = path.join(__dirname, '..', 'admin-ui');

router.use('/static', express.static(ADMIN_UI_DIR));

function getRequestIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
}

function maskFingerprint(value) {
    if (!value) return null;
    const text = String(value);
    if (text.length <= 12) return text;
    return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

function mapLicense(license) {
    return {
        id: license.id,
        key: license.license_key,
        status: license.status,
        gymName: license.gym_name,
        ownerName: license.owner_name,
        ownerEmail: license.owner_email,
        type: license.type,
        deviceLimit: license.device_limit || 1,
        approvedDevices: license.approved_devices || 0,
        totalDevices: license.total_devices || 0,
        lastSeenAt: license.last_seen_at || null,
        lastSeenIp: license.last_seen_ip || null,
        appVersion: license.app_version || null
    };
}

function mapDevice(device) {
    return {
        id: device.id,
        licenseId: device.license_id,
        deviceName: device.device_name,
        platform: device.platform,
        appVersion: device.app_version,
        firstActivatedAt: device.first_activated_at,
        lastSeenAt: device.last_seen_at,
        lastSeenIp: device.last_seen_ip,
        status: device.status,
        fingerprintMasked: maskFingerprint(device.fingerprint)
    };
}

function mapVendorProfile(profile) {
    return {
        displayName: profile?.display_name || '',
        phone: profile?.phone || '',
        whatsapp: profile?.whatsapp || '',
        email: profile?.email || '',
        website: profile?.website || '',
        supportHours: profile?.support_hours || '',
        whatsappTemplate: profile?.whatsapp_template || '',
        version: Number.isInteger(profile?.version) ? profile.version : 1,
        updatedAt: profile?.updated_at || null,
        updatedBy: profile?.updated_by || null
    };
}

function expectsHtmlPage(req) {
    const hasAuthHeader = Boolean(req.headers.authorization);
    const accepts = String(req.headers.accept || '').toLowerCase();
    return !hasAuthHeader && accepts.includes('text/html');
}

function getLicenseById(licenseId) {
    return getOne('SELECT * FROM licenses WHERE id = ?', [licenseId]);
}

function getDeviceById(deviceId) {
    return getOne('SELECT * FROM license_devices WHERE id = ?', [deviceId]);
}

router.get('/login', (req, res) => {
    return res.sendFile(path.join(ADMIN_UI_DIR, 'login.html'));
});

router.get('/', (req, res) => {
    return res.sendFile(path.join(ADMIN_UI_DIR, 'dashboard.html'));
});

router.get('/vendor-profile', (req, res, next) => {
    if (expectsHtmlPage(req)) {
        return res.sendFile(path.join(ADMIN_UI_DIR, 'vendor-profile.html'));
    }
    return next();
});

router.post('/auth/login', (req, res) => {
    try {
        const username = String(req.body?.username || '').trim();
        const password = String(req.body?.password || '');

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                code: 'MISSING_CREDENTIALS',
                message: 'Username and password are required'
            });
        }

        const admin = AdminModel.findByUsername(username);
        if (!admin || !AdminModel.verifyPassword(password, admin.password)) {
            return res.status(401).json({
                success: false,
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid credentials'
            });
        }

        return res.json({
            success: true,
            token: issueLicenseAdminToken(admin),
            admin: {
                id: admin.id,
                username: admin.username,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('[ADMIN] Login error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_LOGIN_ERROR',
            message: 'Failed to login'
        });
    }
});

router.post('/auth/logout', requireLicenseAdminAuth, (req, res) => {
    return res.json({ success: true });
});

router.get('/vendor-profile', requireLicenseAdminAuth, (req, res) => {
    try {
        const profile = VendorProfileModel.get();
        return res.json({
            success: true,
            data: mapVendorProfile(profile)
        });
    } catch (error) {
        console.error('[ADMIN] Get vendor profile error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_VENDOR_PROFILE_FETCH_ERROR',
            message: 'Failed to fetch vendor profile'
        });
    }
});

router.put('/vendor-profile', requireLicenseAdminAuth, (req, res) => {
    try {
        const payload = req.body || {};
        const updated = VendorProfileModel.upsert(
            {
                displayName: payload.displayName,
                phone: payload.phone,
                whatsapp: payload.whatsapp,
                email: payload.email,
                website: payload.website,
                supportHours: payload.supportHours,
                whatsappTemplate: payload.whatsappTemplate
            },
            req.licenseAdmin?.username || `admin:${req.licenseAdmin?.sub || 'unknown'}`
        );

        return res.json({
            success: true,
            message: 'Vendor profile updated',
            data: mapVendorProfile(updated)
        });
    } catch (error) {
        console.error('[ADMIN] Update vendor profile error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_VENDOR_PROFILE_UPDATE_ERROR',
            message: 'Failed to update vendor profile'
        });
    }
});

router.get('/licenses', requireLicenseAdminAuth, (req, res) => {
    try {
        const licenses = LicenseModel.listAllLicensesWithCounts();
        return res.json({
            success: true,
            data: licenses.map(mapLicense)
        });
    } catch (error) {
        console.error('[ADMIN] List licenses error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_LIST_LICENSES_ERROR',
            message: 'Failed to list licenses'
        });
    }
});

router.get('/licenses/:id/devices', requireLicenseAdminAuth, (req, res) => {
    try {
        const licenseId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(licenseId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_LICENSE_ID',
                message: 'Invalid license id'
            });
        }

        const license = getLicenseById(licenseId);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'LICENSE_NOT_FOUND',
                message: 'License not found'
            });
        }

        const devices = getAll(
            'SELECT * FROM license_devices WHERE license_id = ? ORDER BY datetime(last_seen_at) DESC, datetime(first_activated_at) DESC',
            [licenseId]
        );

        return res.json({
            success: true,
            data: devices.map(mapDevice)
        });
    } catch (error) {
        console.error('[ADMIN] List devices error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_LIST_DEVICES_ERROR',
            message: 'Failed to list devices'
        });
    }
});

router.post('/devices/:id/approve', requireLicenseAdminAuth, (req, res) => {
    try {
        const deviceId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(deviceId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_DEVICE_ID',
                message: 'Invalid device id'
            });
        }

        const device = getDeviceById(deviceId);
        if (!device) {
            return res.status(404).json({
                success: false,
                code: 'DEVICE_NOT_FOUND',
                message: 'Device not found'
            });
        }

        const license = getLicenseById(device.license_id);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'LICENSE_NOT_FOUND',
                message: 'License not found'
            });
        }

        const approvedDevices = getAll(
            "SELECT * FROM license_devices WHERE license_id = ? AND status = 'approved' ORDER BY datetime(last_seen_at) ASC, datetime(first_activated_at) ASC",
            [license.id]
        );

        const limit = Math.max(1, Number.parseInt(String(license.device_limit || 1), 10) || 1);
        const needsSlot = device.status !== 'approved' ? 1 : 0;
        const overflow = Math.max(0, approvedDevices.length + needsSlot - limit);

        for (let i = 0; i < overflow; i += 1) {
            const victim = approvedDevices[i];
            if (!victim || victim.id === device.id) {
                continue;
            }
            LicenseModel.setDeviceStatus(victim.id, 'revoked');
            LicenseModel.logActivity(license.id, 'DEVICE_AUTO_REVOKED_FOR_LIMIT', victim.fingerprint, getRequestIp(req), {
                reason: 'device_limit_enforced_on_approve',
                approvedByDeviceId: device.id,
                limit
            }, victim.id);
        }

        LicenseModel.setDeviceStatus(device.id, 'approved');
        LicenseModel.logActivity(license.id, 'DEVICE_APPROVED', device.fingerprint, getRequestIp(req), {
            limit
        }, device.id);

        return res.json({
            success: true,
            message: 'Device approved'
        });
    } catch (error) {
        console.error('[ADMIN] Approve device error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_APPROVE_DEVICE_ERROR',
            message: 'Failed to approve device'
        });
    }
});

router.post('/devices/:id/revoke', requireLicenseAdminAuth, (req, res) => {
    try {
        const deviceId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(deviceId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_DEVICE_ID',
                message: 'Invalid device id'
            });
        }

        const device = getDeviceById(deviceId);
        if (!device) {
            return res.status(404).json({
                success: false,
                code: 'DEVICE_NOT_FOUND',
                message: 'Device not found'
            });
        }

        const license = getLicenseById(device.license_id);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'LICENSE_NOT_FOUND',
                message: 'License not found'
            });
        }

        LicenseModel.setDeviceStatus(device.id, 'revoked');
        LicenseModel.logActivity(license.id, 'DEVICE_REVOKED', device.fingerprint, getRequestIp(req), {
            reason: req.body?.reason || null
        }, device.id);

        return res.json({
            success: true,
            message: 'Device revoked'
        });
    } catch (error) {
        console.error('[ADMIN] Revoke device error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_REVOKE_DEVICE_ERROR',
            message: 'Failed to revoke device'
        });
    }
});

router.post('/licenses/:id/reset', requireLicenseAdminAuth, (req, res) => {
    try {
        const licenseId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(licenseId)) {
            return res.status(400).json({
                success: false,
                code: 'INVALID_LICENSE_ID',
                message: 'Invalid license id'
            });
        }

        const license = getLicenseById(licenseId);
        if (!license) {
            return res.status(404).json({
                success: false,
                code: 'LICENSE_NOT_FOUND',
                message: 'License not found'
            });
        }

        const changed = getAll('SELECT id FROM license_devices WHERE license_id = ? AND status <> ?', [license.id, 'revoked']).length;
        LicenseModel.resetDevicesByKey(license.license_key);
        LicenseModel.logActivity(license.id, 'DEVICES_RESET', null, getRequestIp(req), {
            changed
        });

        return res.json({
            success: true,
            message: 'License devices reset',
            changed
        });
    } catch (error) {
        console.error('[ADMIN] Reset devices error:', error);
        return res.status(500).json({
            success: false,
            code: 'ADMIN_RESET_DEVICES_ERROR',
            message: 'Failed to reset devices'
        });
    }
});

module.exports = router;
