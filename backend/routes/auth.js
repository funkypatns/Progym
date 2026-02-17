/**
 * ============================================
 * AUTHENTICATION ROUTES
 * ============================================
 * 
 * Handles user login, logout, and session management
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { generateToken, authenticate } = require('../middleware/auth');
const permissionsStore = require('../utils/permissionsStore');

const ensureDefaultAdminUser = async (prisma) => {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) return;

    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.$transaction(async (tx) => {
        const stillEmpty = await tx.user.count();
        if (stillEmpty > 0) return;

        await tx.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                email: 'admin@gym.local',
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin',
                isActive: true
            }
        });
    });
};

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login', [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

        // Bootstrap admin on first run (fresh database)
        await ensureDefaultAdminUser(req.prisma);

        // Find user
        const user = await req.prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is disabled. Contact administrator.'
            });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }

        // Update last login
        await req.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: user.id,
                action: 'LOGIN',
                details: JSON.stringify({ ip: req.ip })
            }
        });

        // Generate token
        const token = generateToken(user);

        // Return user data (without password)
        const { password: _, ...userData } = user;

        // Attach Permissions (Runtime Propagation Fix)
        userData.permissions = permissionsStore.getUserEffectivePermissions(user);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: userData,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again.'
        });
    }
});

/**
 * POST /api/auth/logout
 * User logout
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'LOGOUT'
            }
        });

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await req.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                permissions: true, // Required for staff permissions to persist on refresh
                avatar: true,
                isActive: true,
                lastLogin: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach Permissions (Runtime Propagation Fix)
        // Note: req.user already has permissions attached by middleware, but user object here is fresh from DB
        try {
            user.permissions = permissionsStore.getUserEffectivePermissions(user);
        } catch (permError) {
            console.error('[AUTH WARNING] Failed to load permissions for /me:', permError.message);
            user.permissions = [];
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user info'
        });
    }
});

/**
 * PUT /api/auth/password
 * Change password
 */
router.put('/password', authenticate, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Get current user
        const user = await req.prisma.user.findUnique({
            where: { id: req.user.id }
        });

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await req.prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'PASSWORD_CHANGE'
            }
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, [
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('email').optional().isEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { firstName, lastName, email } = req.body;

        const updatedUser = await req.prisma.user.update({
            where: { id: req.user.id },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                ...(email && { email })
            },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                avatar: true
            }
        });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

module.exports = router;
