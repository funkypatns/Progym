/**
 * ============================================
 * PACKAGE PLANS ROUTES
 * ============================================
 * Session-based package plan management
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireActiveShift } = require('../middleware/auth');

router.use(authenticate);

// Require active shift for writes
router.use((req, res, next) => {
    if (req.method !== 'GET') {
        return requireActiveShift(req, res, next);
    }
    next();
});

/**
 * GET /api/package-plans
 * List package plans (active by default)
 */
router.get('/', async (req, res) => {
    try {
        const { all } = req.query;
        const where = {};
        if (!all || all === 'false') {
            where.isActive = true;
        }
        const plans = await req.prisma.packagePlan.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
        });
        return res.json({ success: true, data: plans });
    } catch (error) {
        console.error('Package plans list error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch package plans' });
    }
});

/**
 * POST /api/package-plans
 * Create a new package plan
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            nameAr,
            price,
            totalSessions,
            validityDays,
            description,
            descriptionAr,
            isActive = true,
            businessTypeScope,
            sortOrder = 0
        } = req.body || {};

        const parsedPrice = Number(price);
        const parsedSessions = Number.parseInt(totalSessions, 10);
        const parsedValidity = validityDays !== undefined && validityDays !== null && validityDays !== ''
            ? Number.parseInt(validityDays, 10)
            : null;

        if (!name || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedSessions) || parsedSessions <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid package plan data'
            });
        }

        const plan = await req.prisma.packagePlan.create({
            data: {
                name: name.trim(),
                nameAr: nameAr?.trim() || null,
                price: parsedPrice,
                totalSessions: parsedSessions,
                validityDays: parsedValidity,
                description: description?.trim() || null,
                descriptionAr: descriptionAr?.trim() || null,
                isActive: Boolean(isActive),
                businessTypeScope: businessTypeScope?.trim() || null,
                sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0
            }
        });

        return res.json({ success: true, data: plan });
    } catch (error) {
        console.error('Create package plan error:', error);
        return res.status(500).json({ success: false, message: 'Failed to create package plan' });
    }
});

/**
 * PATCH /api/package-plans/:id
 * Update or deactivate a package plan
 */
router.patch('/:id', async (req, res) => {
    try {
        const parsedId = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(parsedId)) {
            return res.status(400).json({ success: false, message: 'Invalid package plan id' });
        }

        const {
            name,
            nameAr,
            price,
            totalSessions,
            validityDays,
            description,
            descriptionAr,
            isActive,
            businessTypeScope,
            sortOrder
        } = req.body || {};

        const data = {};
        if (name !== undefined) data.name = name.trim();
        if (nameAr !== undefined) data.nameAr = nameAr ? nameAr.trim() : null;
        if (price !== undefined) {
            const parsedPrice = Number(price);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ success: false, message: 'Invalid price' });
            }
            data.price = parsedPrice;
        }
        if (totalSessions !== undefined) {
            const parsedSessions = Number.parseInt(totalSessions, 10);
            if (!Number.isInteger(parsedSessions) || parsedSessions <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid total sessions' });
            }
            data.totalSessions = parsedSessions;
        }
        if (validityDays !== undefined) {
            if (validityDays === null || validityDays === '') {
                data.validityDays = null;
            } else {
                const parsedValidity = Number.parseInt(validityDays, 10);
                if (!Number.isInteger(parsedValidity) || parsedValidity <= 0) {
                    return res.status(400).json({ success: false, message: 'Invalid validity days' });
                }
                data.validityDays = parsedValidity;
            }
        }
        if (description !== undefined) data.description = description ? description.trim() : null;
        if (descriptionAr !== undefined) data.descriptionAr = descriptionAr ? descriptionAr.trim() : null;
        if (isActive !== undefined) data.isActive = Boolean(isActive);
        if (businessTypeScope !== undefined) data.businessTypeScope = businessTypeScope ? businessTypeScope.trim() : null;
        if (sortOrder !== undefined && sortOrder !== null && sortOrder !== '') {
            const parsedSort = Number(sortOrder);
            if (Number.isFinite(parsedSort)) data.sortOrder = parsedSort;
        }

        const plan = await req.prisma.packagePlan.update({
            where: { id: parsedId },
            data
        });

        return res.json({ success: true, data: plan });
    } catch (error) {
        console.error('Update package plan error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update package plan' });
    }
});

module.exports = router;
