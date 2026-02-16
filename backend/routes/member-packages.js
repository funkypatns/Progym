/**
 * ============================================
 * MEMBER PACKAGE ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission, requireActiveShift } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

const normalizeSessionDefaults = (plan, payload) => {
    const explicitSessionName = typeof payload.sessionName === 'string' ? payload.sessionName.trim() : '';
    const fallbackPrice = Number(plan.price || 0) > 0 && Number(plan.packageTotalSessions || 0) > 0
        ? Number(plan.price) / Number(plan.packageTotalSessions)
        : 0;
    const explicitSessionPrice = payload.sessionPrice !== undefined && payload.sessionPrice !== null && payload.sessionPrice !== ''
        ? Number(payload.sessionPrice)
        : NaN;

    return {
        sessionName: explicitSessionName || plan.name || null,
        sessionPrice: Number.isFinite(explicitSessionPrice) && explicitSessionPrice >= 0
            ? explicitSessionPrice
            : fallbackPrice
    };
};

const createMemberPackage = async (req, res) => {
    try {
        const { memberId, planId, startDate } = req.body || {};
        const parsedMemberId = Number.parseInt(memberId, 10);
        const parsedPlanId = Number.parseInt(planId, 10);

        if (!Number.isInteger(parsedMemberId) || !Number.isInteger(parsedPlanId)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid member or plan id' });
        }

        const plan = await req.prisma.subscriptionPlan.findUnique({ where: { id: parsedPlanId } });
        if (!plan || !plan.isActive || plan.type !== 'PACKAGE') {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Package plan not found or inactive' });
        }

        const parsedTotalSessions = Number.parseInt(plan.packageTotalSessions, 10);
        if (!Number.isInteger(parsedTotalSessions) || parsedTotalSessions <= 0) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid package sessions count' });
        }

        const start = startDate ? new Date(startDate) : new Date();
        if (Number.isNaN(start.getTime())) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid start date' });
        }

        const endDate = plan.packageValidityDays
            ? new Date(start.getTime() + plan.packageValidityDays * 24 * 60 * 60 * 1000)
            : null;

        const defaults = normalizeSessionDefaults(plan, req.body || {});
        const created = await req.prisma.$transaction(async (tx) => {
            const existing = await tx.memberPackage.findFirst({
                where: {
                    memberId: parsedMemberId,
                    status: 'ACTIVE'
                }
            });
            if (existing) {
                const err = new Error('Member already has an active package');
                err.status = 409;
                throw err;
            }

            return tx.memberPackage.create({
                data: {
                    memberId: parsedMemberId,
                    planId: plan.id,
                    startDate: start,
                    endDate,
                    totalSessions: parsedTotalSessions,
                    remainingSessions: parsedTotalSessions,
                    sessionName: defaults.sessionName,
                    sessionPrice: defaults.sessionPrice,
                    status: 'ACTIVE',
                    createdByEmployeeId: req.user?.id ?? null
                },
                include: { plan: true }
            });
        });

        return res.status(201).json({ success: true, data: created });
    } catch (error) {
        const status = error.status || 500;
        console.error('Assign member package error:', error);
        return res.status(status).json({ success: false, reason: 'SERVER_ERROR', message: error.message || 'Failed to assign package' });
    }
};

/**
 * POST /api/member-packages/assign
 * Assign/buy a session package for a member
 */
router.post('/assign', requireActiveShift, requirePermission(PERMISSIONS.SUBSCRIPTIONS_CREATE), createMemberPackage);

/**
 * POST /api/member-packages
 * Alias endpoint: purchase package
 */
router.post('/', requireActiveShift, requirePermission(PERMISSIONS.SUBSCRIPTIONS_CREATE), createMemberPackage);

/**
 * GET /api/member-packages?member_id=1
 * List packages for a member (newest first)
 */
router.get('/', requirePermission(PERMISSIONS.MEMBERS_VIEW), async (req, res) => {
    try {
        const rawMemberId = req.query.member_id ?? req.query.memberId;
        const memberId = rawMemberId === undefined ? null : Number.parseInt(rawMemberId, 10);
        if (rawMemberId !== undefined && !Number.isInteger(memberId)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid member id' });
        }

        const where = {};
        if (Number.isInteger(memberId)) where.memberId = memberId;

        const items = await req.prisma.memberPackage.findMany({
            where,
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            include: {
                plan: true,
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        return res.json({ success: true, data: items });
    } catch (error) {
        console.error('List member packages error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to fetch member packages' });
    }
});

module.exports = router;
