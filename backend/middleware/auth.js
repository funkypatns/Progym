/**
 * ============================================
 * AUTHENTICATION MIDDLEWARE
 * ============================================
 * 
 * JWT-based authentication middleware
 * Validates tokens and attaches user to request
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gym-management-secret-key-2024!@#$';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

const permissionsStore = require('../utils/permissionsStore');

/**
 * Generate JWT token for a user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Authentication middleware
 * Validates JWT token from Authorization header
 */
async function authenticate(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'No authorization token provided'
            });
        }

        // Check Bearer format
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authorization format. Use: Bearer <token>'
            });
        }

        // Extract and verify token
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        // EXTRA SAFETY: Verify user still exists in database
        // This prevents foreign key errors if database was reset but JWT is still valid
        // EXTRA SAFETY: Verify user still exists in database
        // This prevents foreign key errors if database was reset but JWT is still valid

        // Use the shared prisma instance from the request (injected in server.js)
        // DO NOT create a new PrismaClient here!
        const user = await req.prisma.user.findUnique({
            where: { id: parseInt(decoded.id) }
        });

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'User session invalid or deactivated. Please login again.'
            });
        }

        // Attach full user info to request
        req.user = user;

        // ATTACH PERMISSIONS (Runtime Propagation Fix)
        try {
            req.user.permissions = permissionsStore.getUserEffectivePermissions(user);
        } catch (permError) {
            console.error('[AUTH WARNING] Failed to load permissions:', permError.message);
            // Default to empty permissions rather than crashing auth
            req.user.permissions = [];
        }

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        console.error('[AUTH MIDDLEWARE ERROR]', error);
        return res.status(500).json({
            success: false,
            message: 'Authentication error',
            debug: error.message
        });
    }
}

/**
 * Role-based authorization middleware
 * @param {...string} roles - Allowed roles
 */
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // MANDATORY DIAGNOSTIC: Log role checking
        console.log(`[AUTH_GUARD] URL: ${req.originalUrl}, Method: ${req.method}`);
        console.log(`[AUTH_GUARD] User:`, req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : 'UNDEFINED');
        console.log(`[AUTH_GUARD] Required: ${JSON.stringify(roles)}`);

        // Case-insensitive & Whitespace-robust role check
        const userRole = (req.user.role || '').trim().toLowerCase();
        const allowedRoles = roles.map(r => r.trim().toLowerCase());

        console.log(`[AUTH_GUARD] Check: "${userRole}" in ${JSON.stringify(allowedRoles)}`);

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Requires one of the following roles: ${roles.join(', ')}`
            });
        }

        next();
    };
}

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = verifyToken(token);
            req.user = decoded;
        }

        next();
    } catch (error) {
        // Ignore errors, just continue without user
        next();
    }
}

/**
 * Middleware to ensure user has an active shift
 * required for all invalidation/write operations
 */
async function requireActiveShift(req, res, next) {
    try {
        // ALWAYS allow read-only (GET) requests
        if (req.method === 'GET') {
            return next();
        }

        // Check if user has an open shift
        // We use req.prisma which is available from server.js
        // STRICT CHECK: Shift is active only if closedAt is NULL
        const activeShift = await req.prisma.pOSShift.findFirst({
            where: {
                openedBy: req.user.id,
                closedAt: null
            }
        });

        if (!activeShift) {
            return res.status(403).json({
                success: false,
                message: 'Action denied. Please open your shift first.'
            });
        }

        // Attach shift info to request for convenience
        req.activeShift = activeShift;
        next();

    } catch (error) {
        console.error('Shift validation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to validate shift status'
        });
    }
}

/**
 * Permission-based authorization middleware
 * Checks if user has a specific permission (granular RBAC)
 * Admin role bypasses all permission checks
 * 
 * @param {string} permission - Required permission (e.g., 'reports.view_financials')
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Admin bypasses all permission checks (Normalized comparison)
        const userRole = req.user.role?.toLowerCase();
        if (userRole === 'admin') {
            return next();
        }

        // Check against EFFECTIVE permissions attached to req.user
        // This is populated in authenticate() middleware from the DB
        const userPermissions = req.user.permissions || [];

        // Check if user has the required permission
        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: `Access denied. Required permission: ${permission}`,
                requiredPermission: permission
            });
        }

        next();
    };
}

/**
 * Check if user has ANY of the specified permissions
 * Useful for endpoints that can be accessed with different permission levels
 * 
 * @param {...string} permissions - List of permissions (user needs at least one)
 * @returns {Function} Express middleware
 */
function requireAnyPermission(...permissions) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Admin bypasses all checks (Normalized comparison)
        const userRole = req.user.role?.toLowerCase();
        if (userRole === 'admin') {
            return next();
        }

        // Check against EFFECTIVE permissions attached to req.user
        const userPermissions = req.user.permissions || [];

        // Check if user has at least one of the required permissions
        const hasPermission = permissions.some(p => userPermissions.includes(p));

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                code: 'PERMISSION_DENIED',
                message: `Access denied. Required one of: ${permissions.join(', ')}`,
                requiredPermissions: permissions
            });
        }

        next();
    };
}

module.exports = {
    generateToken,
    verifyToken,
    authenticate,
    authorize,
    optionalAuth,
    requireActiveShift,
    requirePermission,
    requireAnyPermission,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
