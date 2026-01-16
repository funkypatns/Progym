/**
 * ============================================
 * SUBSCRIPTION PLANS ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
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

        const plans = await req.prisma.subscriptionPlan.findMany({
            where: activeOnly ? { isActive: true } : {},
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
router.post('/', requirePermission(PERMISSIONS.PLANS_MANAGE), [
    body('name').trim().notEmpty().withMessage('Plan name is required'),
    body('duration').isInt({ min: 1 }).withMessage('Duration is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, nameAr, duration, durationType, price, description, descriptionAr, features, sortOrder } = req.body;

        const plan = await req.prisma.subscriptionPlan.create({
            data: {
                name,
                nameAr: nameAr || null,
                duration: parseInt(duration),
                durationType: durationType || 'days',
                price: parseFloat(price),
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
        const { name, nameAr, duration, durationType, price, description, descriptionAr, features, sortOrder, isActive } = req.body;

        const plan = await req.prisma.subscriptionPlan.update({
            where: { id: planId },
            data: {
                ...(name && { name }),
                nameAr: nameAr || null,
                ...(duration && { duration: parseInt(duration) }),
                ...(durationType && { durationType }),
                ...(price !== undefined && { price: parseFloat(price) }),
                description: description || null,
                descriptionAr: descriptionAr || null,
                features: features || null,
                ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
                ...(isActive !== undefined && { isActive })
            }
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
