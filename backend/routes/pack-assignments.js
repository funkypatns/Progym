const express = require('express');
const router = express.Router();
const { authenticate, requirePermission, requireActiveShift } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const { syncStatuses, performPackAssignmentCheckIn } = require('../services/packAssignmentsService');

router.use(authenticate);

const STATUS_LABELS = {
    ACTIVE: 'active',
    COMPLETED: 'exhausted',
    PAUSED: 'paused',
    EXPIRED: 'expired'
};

const parseInteger = (value) => {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) ? n : null;
};

const parseOptionalNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const parseIdempotencyKey = (req) => {
    const raw = String(req.header('Idempotency-Key') || req.header('idempotency-key') || '').trim();
    return raw ? raw.slice(0, 128) : '';
};

const getRouteErrorResponse = (error, fallbackMessage) => {
    if (error?.code === 'P2022') {
        return {
            status: 503,
            body: {
                success: false,
                reason: 'SCHEMA_MISMATCH',
                message: 'Database schema is out of date. Run migrations and retry.'
            }
        };
    }

    return {
        status: 500,
        body: {
            success: false,
            reason: 'SERVER_ERROR',
            message: fallbackMessage
        }
    };
};

const mapStatusFilter = (status) => {
    const normalized = String(status || 'all').toLowerCase();
    if (normalized === 'all') return null;
    if (normalized === 'active') return ['ACTIVE'];
    if (normalized === 'paused') return ['PAUSED'];
    if (normalized === 'exhausted') return ['COMPLETED'];
    if (normalized === 'expired') return ['EXPIRED'];
    return null;
};

const formatAssignment = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        memberId: row.memberId,
        packTemplateId: row.planId,
        totalSessions: row.totalSessions,
        remainingSessions: row.remainingSessions,
        sessionName: row.sessionName || row.plan?.name || null,
        sessionPrice: row.sessionPrice ?? null,
        status: STATUS_LABELS[row.status] || row.status?.toLowerCase() || 'active',
        purchasedAt: row.createdAt,
        expiresAt: row.endDate,
        paymentMethod: row.paymentMethod || null,
        paymentStatus: row.paymentStatus || 'unpaid',
        amountPaid: row.amountPaid ?? 0,
        member: row.member ? {
            id: row.member.id,
            memberId: row.member.memberId,
            firstName: row.member.firstName,
            lastName: row.member.lastName,
            fullName: `${row.member.firstName || ''} ${row.member.lastName || ''}`.trim()
        } : null,
        packTemplate: row.plan ? {
            id: row.plan.id,
            name: row.plan.name,
            totalSessions: row.plan.packageTotalSessions,
            validityDays: row.plan.packageValidityDays,
            priceTotal: row.plan.price
        } : null,
        createdByEmployeeId: row.createdByEmployeeId
    };
};

router.get('/', requirePermission(PERMISSIONS.SUBSCRIPTIONS_VIEW), async (req, res) => {
    try {
        const statusFilter = mapStatusFilter(req.query.status);
        const q = String(req.query.q || '').trim();
        const memberId = parseInteger(req.query.member_id ?? req.query.memberId);

        await syncStatuses(req.prisma, memberId ? { memberId } : {});

        const where = {
            plan: { type: 'PACKAGE' }
        };
        if (memberId) where.memberId = memberId;
        if (statusFilter) where.status = { in: statusFilter };

        if (q) {
            where.OR = [
                { member: { firstName: { contains: q } } },
                { member: { lastName: { contains: q } } },
                { member: { memberId: { contains: q } } },
                { plan: { name: { contains: q } } }
            ];
        }

        const rows = await req.prisma.memberPackage.findMany({
            where,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true
                    }
                },
                plan: {
                    select: {
                        id: true,
                        name: true,
                        packageTotalSessions: true,
                        packageValidityDays: true,
                        price: true
                    }
                }
            },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
        });

        return res.json({ success: true, data: rows.map(formatAssignment) });
    } catch (error) {
        console.error('List pack assignments error:', error);
        const response = getRouteErrorResponse(error, 'Failed to fetch pack assignments');
        return res.status(response.status).json(response.body);
    }
});

router.post('/', requireActiveShift, requirePermission(PERMISSIONS.SUBSCRIPTIONS_CREATE), async (req, res) => {
    try {
        const memberId = parseInteger(req.body.memberId ?? req.body.member_id);
        const templateId = parseInteger(req.body.packTemplateId ?? req.body.pack_template_id ?? req.body.planId ?? req.body.plan_id);
        const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();

        if (!memberId || !templateId || Number.isNaN(startDate.getTime())) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid member, template, or date' });
        }

        const paymentMethod = req.body.paymentMethod ? String(req.body.paymentMethod).toLowerCase() : null;
        const paymentStatus = req.body.paymentStatus ? String(req.body.paymentStatus).toLowerCase() : 'unpaid';
        const amountPaid = parseOptionalNumber(req.body.amountPaid ?? req.body.amount_paid);
        const overrideSessionName = typeof req.body.sessionName === 'string' ? req.body.sessionName.trim() : '';
        const overrideSessionPrice = parseOptionalNumber(req.body.sessionPrice ?? req.body.session_price);

        if (paymentMethod && !['cash', 'card', 'transfer', 'wallet'].includes(paymentMethod)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid payment method' });
        }
        if (!['paid', 'partial', 'unpaid'].includes(paymentStatus)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid payment status' });
        }
        if (amountPaid !== null && amountPaid < 0) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Amount paid must be >= 0' });
        }

        const created = await req.prisma.$transaction(async (tx) => {
            const plan = await tx.subscriptionPlan.findUnique({ where: { id: templateId } });
            if (!plan || !plan.isActive || plan.type !== 'PACKAGE') {
                const err = new Error('Pack template not found or inactive');
                err.status = 400;
                throw err;
            }

            const member = await tx.member.findUnique({ where: { id: memberId }, select: { id: true } });
            if (!member) {
                const err = new Error('Member not found');
                err.status = 404;
                throw err;
            }

            const totalSessions = parseInteger(plan.packageTotalSessions);
            if (!totalSessions || totalSessions <= 0) {
                const err = new Error('Pack template sessions are invalid');
                err.status = 400;
                throw err;
            }

            const activeExisting = await tx.memberPackage.findFirst({
                where: {
                    memberId,
                    status: 'ACTIVE',
                    plan: { type: 'PACKAGE' }
                },
                select: { id: true }
            });
            if (activeExisting) {
                const err = new Error('Member already has an active session pack');
                err.status = 409;
                throw err;
            }

            const expiresAt = plan.packageValidityDays
                ? new Date(startDate.getTime() + Number(plan.packageValidityDays) * 24 * 60 * 60 * 1000)
                : null;

            const fallbackSessionPrice = Number(plan.price || 0) > 0 && totalSessions > 0
                ? Number(plan.price) / totalSessions
                : 0;

            return tx.memberPackage.create({
                data: {
                    memberId,
                    planId: templateId,
                    startDate,
                    endDate: expiresAt,
                    totalSessions,
                    remainingSessions: totalSessions,
                    sessionName: overrideSessionName || plan.name,
                    sessionPrice: overrideSessionPrice !== null ? overrideSessionPrice : fallbackSessionPrice,
                    status: 'ACTIVE',
                    paymentMethod,
                    paymentStatus,
                    amountPaid: amountPaid ?? 0,
                    createdByEmployeeId: req.user?.id || null
                },
                include: {
                    member: {
                        select: {
                            id: true,
                            memberId: true,
                            firstName: true,
                            lastName: true
                        }
                    },
                    plan: {
                        select: {
                            id: true,
                            name: true,
                            packageTotalSessions: true,
                            packageValidityDays: true,
                            price: true
                        }
                    }
                }
            });
        });

        return res.status(201).json({ success: true, data: formatAssignment(created) });
    } catch (error) {
        console.error('Assign pack error:', error);
        const status = error.status || 500;
        const reason = status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST';
        return res.status(status).json({ success: false, reason, message: error.message || 'Failed to assign pack' });
    }
});

router.get('/:id', requirePermission(PERMISSIONS.SUBSCRIPTIONS_VIEW), async (req, res) => {
    try {
        const assignmentId = parseInteger(req.params.id);
        if (!assignmentId) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid assignment id' });
        }

        await syncStatuses(req.prisma, { id: assignmentId });

        const row = await req.prisma.memberPackage.findFirst({
            where: { id: assignmentId, plan: { type: 'PACKAGE' } },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                },
                plan: {
                    select: {
                        id: true,
                        name: true,
                        packageTotalSessions: true,
                        packageValidityDays: true,
                        price: true,
                        description: true
                    }
                }
            }
        });

        if (!row) {
            return res.status(404).json({ success: false, reason: 'NOT_FOUND', message: 'Pack assignment not found' });
        }

        return res.json({ success: true, data: formatAssignment(row) });
    } catch (error) {
        console.error('Get pack assignment error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to fetch pack assignment' });
    }
});

router.patch('/:id/status', requirePermission(PERMISSIONS.SUBSCRIPTIONS_CREATE), async (req, res) => {
    try {
        const assignmentId = parseInteger(req.params.id);
        const status = String(req.body.status || '').toLowerCase();
        const mapping = {
            active: 'ACTIVE',
            paused: 'PAUSED',
            exhausted: 'COMPLETED'
        };
        const nextStatus = mapping[status];

        if (!assignmentId || !nextStatus) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid assignment id or status' });
        }

        const row = await req.prisma.memberPackage.update({
            where: { id: assignmentId },
            data: { status: nextStatus },
            include: {
                member: { select: { id: true, memberId: true, firstName: true, lastName: true } },
                plan: { select: { id: true, name: true, packageTotalSessions: true, packageValidityDays: true, price: true } }
            }
        });

        return res.json({ success: true, data: formatAssignment(row) });
    } catch (error) {
        console.error('Update pack assignment status error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to update assignment status' });
    }
});

router.post('/:id/checkins', requirePermission(PERMISSIONS.CHECKINS_MANAGE), async (req, res) => {
    const idempotencyKey = parseIdempotencyKey(req);
    try {
        const assignmentId = parseInteger(req.params.id);
        if (!assignmentId) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid assignment id' });
        }

        const explicitSessionName = typeof req.body.sessionName === 'string' ? req.body.sessionName.trim() : '';
        const explicitSessionPrice = parseOptionalNumber(req.body.sessionPrice);
        const { payload, replay } = await performPackAssignmentCheckIn({
            prisma: req.prisma,
            assignmentId,
            idempotencyKey,
            sessionName: explicitSessionName,
            sessionPrice: explicitSessionPrice,
            actorUserId: req.user?.id || null,
            formatAssignment
        });

        return res.json({ success: true, data: payload, idempotentReplay: replay });
    } catch (error) {
        console.error('Pack check-in error:', error);
        const status = error.status || 500;
        return res.status(status).json({
            success: false,
            reason: status >= 500 ? 'SERVER_ERROR' : 'BAD_REQUEST',
            message: error.message || 'Failed to check in pack'
        });
    }
});

router.get('/:id/checkins', requirePermission(PERMISSIONS.SUBSCRIPTIONS_VIEW), async (req, res) => {
    try {
        const assignmentId = parseInteger(req.params.id);
        if (!assignmentId) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid assignment id' });
        }

        const rows = await req.prisma.packageSessionUsage.findMany({
            where: { memberPackageId: assignmentId },
            orderBy: { dateTime: 'desc' },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true
                    }
                },
                createdByEmployee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true
                    }
                }
            }
        });

        const data = rows.map((row) => ({
            id: row.id,
            memberId: row.memberId,
            assignmentId: row.memberPackageId,
            sessionName: row.sessionName,
            sessionPrice: row.sessionPrice,
            checkedInAt: row.dateTime,
            source: row.source,
            createdBy: row.createdByEmployee
                ? {
                    id: row.createdByEmployee.id,
                    name: `${row.createdByEmployee.firstName || ''} ${row.createdByEmployee.lastName || ''}`.trim() || row.createdByEmployee.username
                }
                : null,
            member: row.member
                ? {
                    id: row.member.id,
                    memberId: row.member.memberId,
                    fullName: `${row.member.firstName || ''} ${row.member.lastName || ''}`.trim()
                }
                : null
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error('List pack check-ins error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to fetch pack check-ins' });
    }
});

module.exports = router;
