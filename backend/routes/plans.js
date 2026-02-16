/**
 * ============================================
 * SUBSCRIPTION PLANS ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

/**
 * GET /api/plans
 * Get all subscription plans
 */
router.get('/', requirePermission(PERMISSIONS.PLANS_VIEW), async (req, res) => {
    try {
        const activeOnly = req.query.active === 'true';
        const type = req.query.type ? String(req.query.type).toUpperCase() : null;
        if (type && !['MEMBERSHIP', 'PACKAGE'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid plan type' });
        }

        const where = {};
        if (activeOnly) where.isActive = true;
        if (type) {
            where.type = type;
        } else {
            // Default to membership for legacy flows
            where.type = 'MEMBERSHIP';
        }

        const plans = await req.prisma.subscriptionPlan.findMany({
            where,
            orderBy: { sortOrder: 'asc' }
        });

        res.json({
            success: true,
            data: plans
        });

    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch plans'
        });
    }
});

/**
 * POST /api/plans
 * Create new plan
 */
router.post('/', requirePermission(PERMISSIONS.PLANS_MANAGE), async (req, res) => {
    try {
        const {
            name,
            nameAr,
            duration,
            durationType,
            price,
            description,
            descriptionAr,
            features,
            sortOrder,
            type,
            packageTotalSessions,
            packageValidityDays,
            packageSessionServiceId
        } = req.body;

        const normalizedType = type ? String(type).toUpperCase() : 'MEMBERSHIP';
        if (!['MEMBERSHIP', 'PACKAGE'].includes(normalizedType)) {
            return res.status(400).json({ success: false, message: 'Invalid plan type' });
        }
        if (!name || !String(name).trim()) {
            return res.status(400).json({ success: false, message: 'Plan name is required' });
        }
        const parsedPrice = parseFloat(price);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ success: false, message: 'Price is required' });
        }

        let parsedDuration = Number.parseInt(duration, 10);
        if (normalizedType === 'MEMBERSHIP') {
            if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
                return res.status(400).json({ success: false, message: 'Duration is required' });
            }
        } else {
            const parsedValidity = packageValidityDays !== undefined && packageValidityDays !== null && packageValidityDays !== ''
                ? Number.parseInt(packageValidityDays, 10)
                : null;
            parsedDuration = Number.isInteger(parsedValidity) && parsedValidity > 0 ? parsedValidity : 1;
        }

        const parsedTotalSessions = packageTotalSessions !== undefined && packageTotalSessions !== null && packageTotalSessions !== ''
            ? Number.parseInt(packageTotalSessions, 10)
            : null;
        if (normalizedType === 'PACKAGE') {
            if (!Number.isInteger(parsedTotalSessions) || parsedTotalSessions <= 0) {
                return res.status(400).json({ success: false, message: 'Total sessions is required' });
            }
        }

        const plan = await req.prisma.subscriptionPlan.create({
            data: {
                name: String(name).trim(),
                nameAr: nameAr || null,
                type: normalizedType,
                duration: parsedDuration,
                durationType: durationType || 'days',
                price: parsedPrice,
                packageTotalSessions: normalizedType === 'PACKAGE' ? parsedTotalSessions : null,
                packageValidityDays: normalizedType === 'PACKAGE'
                    ? (packageValidityDays === undefined || packageValidityDays === null || packageValidityDays === '' ? null : Number.parseInt(packageValidityDays, 10))
                    : null,
                packageSessionServiceId: normalizedType === 'PACKAGE'
                    ? (packageSessionServiceId !== undefined && packageSessionServiceId !== null && packageSessionServiceId !== '' ? Number.parseInt(packageSessionServiceId, 10) : null)
                    : null,
                description: description || null,
                descriptionAr: descriptionAr || null,
                features: features || null,
                sortOrder: sortOrder || 0,
                isActive: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Plan created successfully',
            data: plan
        });

    } catch (error) {
        console.error('Create plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create plan'
        });
    }
});

/**
 * PUT /api/plans/:id
 * Update plan
 */
router.put('/:id', requirePermission(PERMISSIONS.PLANS_MANAGE), async (req, res) => {
    try {
        const planId = parseInt(req.params.id);
        const {
            name,
            nameAr,
            duration,
            durationType,
            price,
            description,
            descriptionAr,
            features,
            sortOrder,
            isActive,
            type,
            packageTotalSessions,
            packageValidityDays,
            packageSessionServiceId
        } = req.body;

        const data = {};
        if (name !== undefined) data.name = String(name).trim();
        if (nameAr !== undefined) data.nameAr = nameAr || null;
        if (duration !== undefined) {
            const parsedDuration = Number.parseInt(duration, 10);
            if (!Number.isInteger(parsedDuration) || parsedDuration < 1) {
                return res.status(400).json({ success: false, message: 'Invalid duration' });
            }
            data.duration = parsedDuration;
        }
        if (durationType !== undefined) data.durationType = durationType || 'days';
        if (price !== undefined) {
            const parsedPrice = parseFloat(price);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ success: false, message: 'Invalid price' });
            }
            data.price = parsedPrice;
        }
        if (description !== undefined) data.description = description || null;
        if (descriptionAr !== undefined) data.descriptionAr = descriptionAr || null;
        if (features !== undefined) data.features = features || null;
        if (sortOrder !== undefined) data.sortOrder = parseInt(sortOrder, 10) || 0;
        if (isActive !== undefined) data.isActive = Boolean(isActive);

        if (type !== undefined) {
            const normalizedType = String(type).toUpperCase();
            if (!['MEMBERSHIP', 'PACKAGE'].includes(normalizedType)) {
                return res.status(400).json({ success: false, message: 'Invalid plan type' });
            }
            data.type = normalizedType;
        }
        if (packageTotalSessions !== undefined) {
            const parsedTotal = Number.parseInt(packageTotalSessions, 10);
            if (!Number.isInteger(parsedTotal) || parsedTotal <= 0) {
                return res.status(400).json({ success: false, message: 'Invalid total sessions' });
            }
            data.packageTotalSessions = parsedTotal;
        }
        if (packageValidityDays !== undefined) {
            if (packageValidityDays === null || packageValidityDays === '') {
                data.packageValidityDays = null;
            } else {
                const parsedValidity = Number.parseInt(packageValidityDays, 10);
                if (!Number.isInteger(parsedValidity) || parsedValidity <= 0) {
                    return res.status(400).json({ success: false, message: 'Invalid validity days' });
                }
                data.packageValidityDays = parsedValidity;
            }
        }
        if (packageSessionServiceId !== undefined) {
            if (packageSessionServiceId === null || packageSessionServiceId === '') {
                data.packageSessionServiceId = null;
            } else {
                const parsedServiceId = Number.parseInt(packageSessionServiceId, 10);
                if (!Number.isInteger(parsedServiceId)) {
                    return res.status(400).json({ success: false, message: 'Invalid service id' });
                }
                data.packageSessionServiceId = parsedServiceId;
            }
        }

        const plan = await req.prisma.subscriptionPlan.update({
            where: { id: planId },
            data
        });

        res.json({
            success: true,
            message: 'Plan updated successfully',
            data: plan
        });

    } catch (error) {
        console.error('Update plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update plan'
        });
    }
});

/**
 * DELETE /api/plans/:id
 * Delete plan (soft delete)
 */
router.delete('/:id', requirePermission(PERMISSIONS.PLANS_MANAGE), async (req, res) => {
    try {
        const planId = parseInt(req.params.id);

        await req.prisma.subscriptionPlan.update({
            where: { id: planId },
            data: { isActive: false }
        });

        res.json({
            success: true,
            message: 'Plan deleted successfully'
        });

    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete plan'
        });
    }
});

module.exports = router;
