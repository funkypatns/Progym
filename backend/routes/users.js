/**
 * ============================================
 * USER MANAGEMENT ROUTES (ADMIN ONLY)
 * ============================================
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const permissionsStore = require('../utils/permissionsStore');

/**
 * GET /api/users/list
 * List all users with minimal info (for dropdowns) - accessible by all authenticated users
 */
router.get('/list', authenticate, async (req, res) => {
    try {
        const users = await req.prisma.user.findMany({
            where: { isActive: true },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true
            },
            orderBy: { firstName: 'asc' }
        });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const { normalizePermissions } = require('../utils/permissionsStore');

/**
 * GET /api/users/permissions/list
 * Get all users with their permissions (admin-only)
 */
router.get('/permissions/list', authenticate, authorize('admin'), async (req, res) => {
    try {
        // Get users from database
        const users = await req.prisma.user.findMany({
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                permissions: true, // Fetch raw permissions string
                isActive: true,
                lastLogin: true,
                createdAt: true
            },
            orderBy: { firstName: 'asc' }
        });

        // Format for frontend
        const usersWithPermissions = users.map(user => ({
            ...user,
            permissionsArray: normalizePermissions(user.permissions)
        }));

        res.json({ success: true, data: usersWithPermissions });
    } catch (error) {
        console.error('[USERS PERMISSIONS] ERROR:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/users/:id/permissions
 * Update user permissions (admin-only)
 */
router.put('/:id/permissions', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { permissions, role } = req.body;
        const userId = parseInt(req.params.id);

        // Validate permissions is an array
        if (permissions && !Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: 'Permissions must be an array' });
        }

        // Update user in database
        const updateData = {};
        if (role) updateData.role = role;
        if (permissions !== undefined) {
            updateData.permissions = JSON.stringify(permissions);
        }

        const updatedUser = await req.prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                permissions: true
            }
        });

        res.json({
            success: true,
            message: 'Permissions updated successfully',
            data: {
                ...updatedUser,
                permissionsArray: normalizePermissions(updatedUser.permissions)
            }
        });
    } catch (error) {
        console.error('[USERS PERMISSIONS] Error updating permissions:', error.message);
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

// All routes below this require admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (req, res) => {
    // MANDATORY DIAGNOSTIC: Employees list hit
    console.log(`[EMPLOYEES_LIST] Hit by user: ${req.user?.username}, Role: ${req.user?.role}`);

    try {
        const users = await req.prisma.user.findMany({
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                lastLogin: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/users
 * Create new user
 */
router.post('/', [
    body('username').trim().notEmpty(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn(['admin', 'staff'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

        const { username, password, email, firstName, lastName, role } = req.body;

        // Check if username already exists
        const existingUser = await req.prisma.user.findFirst({
            where: {
                OR: [
                    { username: username },
                    ...(email ? [{ email: email }] : [])
                ]
            }
        });

        if (existingUser) {
            const field = existingUser.username === username ? 'Username' : 'Email';
            return res.status(400).json({ success: false, message: `${field} already exists` });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await req.prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                email: email || null, // Convert empty string to null
                firstName,
                lastName,
                role,
                isActive: true
            }
        });

        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, message: 'User created', data: userWithoutPassword });

    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Username or Email already exists' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', [
    body('username').optional().trim().notEmpty(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
    body('role').optional().isIn(['admin', 'staff'])
], async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, firstName, lastName, role, isActive, password } = req.body;

        const updateData = {
            ...(username && { username }),
            ...(email !== undefined && { email }),
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(role && { role }),
            ...(isActive !== undefined && { isActive })
        };

        if (password && password.length >= 6) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await req.prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        const { password: _, ...userWithoutPassword } = user;
        res.json({ success: true, message: 'User updated', data: userWithoutPassword });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
