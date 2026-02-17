const jwt = require('jsonwebtoken');

const LICENSE_ADMIN_JWT_SECRET = process.env.LICENSE_ADMIN_JWT_SECRET || 'license-server-admin-secret-change-me';
const LICENSE_ADMIN_JWT_EXPIRES_IN = process.env.LICENSE_ADMIN_JWT_EXPIRES_IN || '12h';
const LICENSE_ADMIN_JWT_ISSUER = 'license-server-admin';
const LICENSE_ADMIN_JWT_AUDIENCE = 'license-admin-dashboard';

function issueLicenseAdminToken(admin) {
    return jwt.sign(
        {
            sub: String(admin.id),
            username: admin.username,
            role: admin.role || 'admin',
            scope: 'license_admin'
        },
        LICENSE_ADMIN_JWT_SECRET,
        {
            algorithm: 'HS256',
            expiresIn: LICENSE_ADMIN_JWT_EXPIRES_IN,
            issuer: LICENSE_ADMIN_JWT_ISSUER,
            audience: LICENSE_ADMIN_JWT_AUDIENCE
        }
    );
}

function parseBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return '';
    }
    return authHeader.slice(7).trim();
}

function verifyLicenseAdminToken(token) {
    return jwt.verify(token, LICENSE_ADMIN_JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: LICENSE_ADMIN_JWT_ISSUER,
        audience: LICENSE_ADMIN_JWT_AUDIENCE
    });
}

function requireLicenseAdminAuth(req, res, next) {
    const token = parseBearerToken(req);
    if (!token) {
        return res.status(401).json({
            success: false,
            code: 'ADMIN_AUTH_REQUIRED',
            message: 'License admin authentication required'
        });
    }

    try {
        req.licenseAdmin = verifyLicenseAdminToken(token);
        return next();
    } catch (_) {
        return res.status(401).json({
            success: false,
            code: 'ADMIN_AUTH_INVALID',
            message: 'Invalid or expired license admin token'
        });
    }
}

module.exports = {
    issueLicenseAdminToken,
    parseBearerToken,
    verifyLicenseAdminToken,
    requireLicenseAdminAuth
};
