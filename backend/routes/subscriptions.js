/**
 * ============================================
 * SUBSCRIPTION ROUTES
 * ============================================
 * 
 * Manages member subscriptions
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, requirePermission, authorize, requireActiveShift, requireAnyPermission } = require('../middleware/auth');

// The global authenticate middleware is removed as it's now applied per route where needed,
// or specifically for write operations.
// Restore global authentication to ensure requireActiveShift has access to req.user
router.use(authenticate);

// All write operations require an active shift
router.use(['/'], (req, res, next) => {
    if (req.method !== 'GET') {
        return requireActiveShift(req, res, next);
    }
    next();
});

/**
 * Generate unique receipt number
 */
function generateReceiptNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RCP-${year}${month}-${random}`;
}

/**
 * GET /api/subscriptions
 * Get all subscriptions with filters
 */
router.get('/', async (req, res) => {
    try {
        const { status, memberId, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;
        if (memberId) where.memberId = parseInt(memberId);

        const [rawSubscriptions, total] = await Promise.all([
            req.prisma.subscription.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    member: {
                        select: { id: true, memberId: true, firstName: true, lastName: true, phone: true, lastRenewalDate: true }
                    },
                    plan: true,
                    payments: {
                        take: 1,
                        orderBy: { paidAt: 'desc' },
                        include: {
                            creator: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        }
                    }
                }
            }),
            req.prisma.subscription.count({ where })
        ]);

        // Calculate days remaining and payment status
        const subscriptions = rawSubscriptions.map(sub => {
            const now = new Date();
            const end = new Date(sub.endDate);
            const diffTime = end - now;
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const total = sub.price !== null ? sub.price : sub.plan.price;
            const paid = sub.paidAmount || 0;

            // Calculate total refunded from payments
            const refundedTotal = sub.payments ? sub.payments.reduce((sum, p) => sum + (p.refundedTotal || 0), 0) : 0;
            const netPaid = Math.max(0, paid - refundedTotal);

            let paymentStatus = 'unpaid';
            if (paid >= total) paymentStatus = 'paid'; // Status reflects INITIAL payment completion, not current net
            else if (paid > 0) paymentStatus = 'partial';

            return {
                ...sub,
                daysRemaining: daysRemaining,
                status: daysRemaining <= 0 && sub.status === 'active' ? 'expired' : sub.status,
                paymentStatus,
                totalPrice: total,
                refundedTotal,
                netPaid
            };
        });

        res.json({
            success: true,
            data: {
                subscriptions,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscriptions'
        });
    }
});

/**
 * POST /api/subscriptions
 * Create new subscription for member
 */
router.post('/', [
    // Validation
    body('memberId').isInt().withMessage('Member ID is required'),
    body('planId').isInt().withMessage('Plan ID is required'),
    body('amount').optional().isFloat({ min: 0 }),
    body('method').optional().isIn(['cash', 'card', 'transfer', 'other'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        // 1. RBAC Check (Inline to handle complex AND logic if needed, or strictly enforcement)
        // User needs 'subscriptions.create' AND 'payments.create' if there is a payment
        if (req.user.role !== 'admin') {
            const userPerms = req.user.permissions || [];
            // Check essential permission
            if (!userPerms.includes('subscriptions.create')) {
                return res.status(403).json({ success: false, message: 'Access denied. Missing "subscriptions.create" permission.' });
            }
            // If handling payment (paidAmount > 0), check payment permission
            if (req.body.paidAmount && parseFloat(req.body.paidAmount) > 0) {
                if (!userPerms.includes('payments.create')) {
                    return res.status(403).json({ success: false, message: 'Access denied. Missing "payments.create" permission.' });
                }
            }
        }

        const { memberId, planId, startDate, paidAmount, paymentStatus, transactionRef, discount, notes, method = 'cash', collectorId, externalReference } = req.body;

        // 2. Safe Reference Handling
        const { transactionRef: tr, externalReference: er } = req.body || {};
        const rawRef = tr || er || null;
        // User requested Safe Logic:
        const safeRef = (method !== 'cash' && rawRef && String(rawRef).trim())
            ? String(rawRef).trim()
            : null;

        // 3. Logic & Data Prep
        const plan = await req.prisma.subscriptionPlan.findUnique({ where: { id: parseInt(planId) } });
        if (!plan) return res.status(404).json({ success: false, message: 'Subscription plan not found' });

        const member = await req.prisma.member.findUnique({ where: { id: parseInt(memberId) } });
        if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

        let initialPaid = 0;
        if (paymentStatus === 'paid') initialPaid = plan.price;
        else if (paymentStatus === 'partial' && paidAmount) initialPaid = parseFloat(paidAmount);

        const numericPaidAmount = initialPaid;
        const numericDiscount = discount ? parseFloat(discount) : 0;

        // 4. Create Subscription (Transaction)
        const result = await req.prisma.$transaction(async (prisma) => {
            // Expire old
            await prisma.subscription.updateMany({
                where: { memberId: parseInt(memberId), status: 'active' },
                data: { status: 'expired' }
            });

            const start = startDate ? new Date(startDate) : new Date();
            const end = new Date(start);
            end.setDate(end.getDate() + plan.duration);

            const sub = await prisma.subscription.create({
                data: {
                    memberId: parseInt(memberId),
                    planId: parseInt(planId),
                    startDate: start,
                    endDate: end,
                    status: 'active',
                    price: plan.price,
                    paidAmount: numericPaidAmount,
                    discount: numericDiscount,
                    notes: notes || null
                },
                include: { member: true, plan: true }
            });

            // 5. Create Payment (if applicable)
            if (numericPaidAmount > 0) {
                // Detect shift
                let finalCreatedBy = req.user.id;
                let finalCollectorName = `${req.user.firstName} ${req.user.lastName}`;

                // Admin override logic
                if (req.user.role === 'admin' && collectorId) {
                    finalCreatedBy = parseInt(collectorId);
                    // fetch collector name if needed, or rely on logic
                }

                let shiftId = null;
                // Use the shift attached by requireActiveShift middleware if available
                if (req.activeShift) {
                    shiftId = req.activeShift.id;
                } else {
                    // Fallback manual check
                    const userShift = await prisma.pOSShift.findFirst({
                        where: { openedBy: finalCreatedBy, closedAt: null }
                    });
                    if (userShift) shiftId = userShift.id;
                }

                await prisma.payment.create({
                    data: {
                        memberId: sub.memberId,
                        subscriptionId: sub.id,
                        amount: numericPaidAmount,
                        method: String(method).toLowerCase().trim(),
                        status: 'completed',
                        receiptNumber: generateReceiptNumber(),
                        notes: `${paymentStatus === 'paid' ? 'Full' : 'Partial'} subscription` + (safeRef ? ` (Ref: ${safeRef})` : '') + (notes ? ` - ${notes}` : ''),
                        shiftId: shiftId,
                        createdBy: finalCreatedBy,
                        collectorName: finalCollectorName,
                        // Mapped field: transactionRef (schema) <= safeRef
                        // Use externalReference as preferred field
                        externalReference: safeRef
                    }
                });
            }
            return sub;
        });

        // Log Activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'CREATE_SUBSCRIPTION',
                entityType: 'Subscription',
                entityId: result.id,
                details: JSON.stringify({ planName: plan.name, amount: numericPaidAmount })
            }
        });

        res.status(201).json({ success: true, message: 'Subscription created', data: result });

    } catch (error) {
        console.error('Create subscription error:', error);
        // Return 500 only for actual crashes, but validation/logic errors should be handled above
        res.status(500).json({
            success: false,
            message: 'Failed to create subscription',
            debug: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


/**
 * PUT /api/subscriptions/:id/renew
 * Renew subscription
 */
/**
 * PUT /api/subscriptions/:id/renew
 * Renew subscription -> Creates a NEW subscription cycle
 */
router.put('/:id/renew', async (req, res) => {
    try {
        const previousSubscriptionId = parseInt(req.params.id);
        const { planId, paidAmount, paymentStatus, externalReference, method = 'cash', collectorId, collectorName, notes } = req.body;

        const result = await req.prisma.$transaction(async (prisma) => {
            // 1. Validate Previous Subscription
            const previousSub = await prisma.subscription.findUnique({
                where: { id: previousSubscriptionId },
                include: { plan: true }
            });

            if (!previousSub) throw new Error('Previous subscription not found');


            // 2. Validate New Plan
            const newPlan = await prisma.subscriptionPlan.findUnique({
                where: { id: parseInt(planId) }
            });
            if (!newPlan) throw new Error('New plan not found');

            // 2.5 Safety: Expire any EXISTING active subscriptions for this member
            // (Similar to Assign Subscription logic)
            await prisma.subscription.updateMany({
                where: {
                    memberId: previousSub.memberId,
                    status: 'active'
                },
                data: { status: 'expired' }
            });

            // 3. Calculate Financials for NEW Subscription
            let initialPaid = 0;
            if (paymentStatus === 'paid') initialPaid = newPlan.price;
            else if (paymentStatus === 'partial' && paidAmount) initialPaid = parseFloat(paidAmount);

            const numericPaidAmount = initialPaid;

            // 4. Create NEW Subscription
            // Start date is NOW (since it's a renewal action happening now)
            // OR if the previous one is still active (future expiry), should we stack? 
            // User rule: "Renew: Use when member had an ENDED/CANCELED subscription... MUST create a NEW cycle"
            // If previous is active, we should technically "Assign" a new one that starts in future? 
            // For simplicity/User Rule: This endpoint treats it as a fresh start from Now.

            const start = new Date();
            const end = new Date(start);
            end.setDate(end.getDate() + newPlan.duration);

            const newSub = await prisma.subscription.create({
                data: {
                    memberId: previousSub.memberId,
                    planId: newPlan.id,
                    startDate: start,
                    endDate: end,
                    status: 'active',
                    price: newPlan.price,
                    paidAmount: numericPaidAmount,
                    notes: notes || `Renewal of prev sub #${previousSubscriptionId}`,
                    // usedNonRefundableAmount starts at 0 for new sub
                },
                include: {
                    member: true,
                    plan: true
                }
            });

            // 5. Handle Payment for NEW Subscription
            if (numericPaidAmount > 0) {
                let finalCreatedBy = req.user.id;
                let finalCollectorName = `${req.user.firstName} ${req.user.lastName}`;

                if (req.user.role === 'admin' && collectorId) {
                    finalCreatedBy = parseInt(collectorId);
                    if (collectorName) finalCollectorName = collectorName;
                }

                let shiftId = null;
                if (req.activeShift) {
                    shiftId = req.activeShift.id;
                } else {
                    const userShift = await prisma.pOSShift.findFirst({
                        where: { openedBy: finalCreatedBy, closedAt: null }
                    });
                    if (userShift) shiftId = userShift.id;
                }

                await prisma.payment.create({
                    data: {
                        memberId: newSub.memberId,
                        subscriptionId: newSub.id,
                        amount: numericPaidAmount,
                        method: String(method).toLowerCase().trim(),
                        status: 'completed',
                        receiptNumber: generateReceiptNumber(),
                        notes: `Renewal Payment: ${paymentStatus === 'paid' ? 'Full' : 'Partial'}` + (externalReference ? ` (Ref: ${externalReference})` : ''),
                        shiftId: shiftId,
                        createdBy: finalCreatedBy,
                        collectorName: finalCollectorName,
                        externalReference: externalReference
                    }
                });
            }

            return newSub;
        });

        // Log
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'RENEW_SUBSCRIPTION',
                entityType: 'Subscription',
                entityId: result.id, // ID of the NEW subscription
                details: JSON.stringify({
                    previousId: previousSubscriptionId,
                    newPlan: result.plan.name
                })
            }
        });

        res.json({
            success: true,
            message: 'Subscription renewed successfully (New cycle created)',
            data: result
        });

    } catch (error) {
        console.error('Renew subscription error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to renew subscription'
        });
    }
});

/**
 * PUT /api/subscriptions/:id/freeze
 * Freeze subscription
 */
router.put('/:id/freeze', [
    body('days').isInt({ min: 1, max: 30 }).withMessage('Freeze days must be between 1-30')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const subscriptionId = parseInt(req.params.id);
        const { days } = req.body;

        const subscription = await req.prisma.subscription.findUnique({
            where: { id: subscriptionId }
        });

        if (!subscription || subscription.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'Can only freeze active subscriptions'
            });
        }

        const frozenUntil = new Date();
        frozenUntil.setDate(frozenUntil.getDate() + days);

        // Extend end date
        const newEndDate = new Date(subscription.endDate);
        newEndDate.setDate(newEndDate.getDate() + days);

        const updated = await req.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'frozen',
                frozenAt: new Date(),
                frozenUntil,
                frozenDays: days,
                endDate: newEndDate
            }
        });

        res.json({
            success: true,
            message: `Subscription frozen for ${days} days`,
            data: updated
        });

    } catch (error) {
        console.error('Freeze subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to freeze subscription'
        });
    }
});

/**
 * PUT /api/subscriptions/:id/unfreeze
 * Unfreeze subscription
 */
router.put('/:id/unfreeze', async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);

        const subscription = await req.prisma.subscription.findUnique({
            where: { id: subscriptionId }
        });

        if (!subscription || subscription.status !== 'frozen') {
            return res.status(400).json({
                success: false,
                message: 'Subscription is not frozen'
            });
        }

        const updated = await req.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                status: 'active',
                frozenAt: null,
                frozenUntil: null
            }
        });

        res.json({
            success: true,
            message: 'Subscription unfrozen',
            data: updated
        });

    } catch (error) {
        console.error('Unfreeze subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unfreeze subscription'
        });
    }
});

/**
 * PUT /api/subscriptions/:id/cancel
 * Cancel subscription
 */
/**
 * GET /api/subscriptions/:id/preview-cancel
 * Preview cancellation financials without executing
 */
router.get('/:id/preview-cancel', authorize('admin'), async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const sub = await req.prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { plan: true, payments: { include: { refunds: true } } }
        });

        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

        const paidTotal = sub.paidAmount || 0;
        // Consistent calculation: Sum refunds from payments
        const refundedTotal = sub.payments.reduce((acc, p) => acc + (p.refunds.reduce((s, r) => s + r.amount, 0)), 0);

        const now = new Date();
        const start = new Date(sub.startDate);
        const totalDuration = sub.plan.duration;
        let usedDays = 0;
        if (now > start) {
            const diffTime = Math.abs(now - start);
            usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        if (usedDays > totalDuration) usedDays = totalDuration;
        if (usedDays < 0) usedDays = 0;

        const totalPrice = sub.price !== null ? sub.price : sub.plan.price;
        const dailyRate = totalPrice / totalDuration;
        let usedAmount = usedDays * dailyRate;
        if (usedAmount > paidTotal) usedAmount = paidTotal;

        let refundableAmount = paidTotal - refundedTotal - usedAmount;
        if (refundableAmount < 0) refundableAmount = 0;

        res.json({
            success: true,
            data: {
                paidTotal,
                refundedTotal,
                usedDays,
                totalDuration,
                usedAmount,
                refundableAmount,
                netRetained: usedAmount
            }
        });
    } catch (error) {
        console.error('Preview cancel error:', error);
        res.status(500).json({ success: false, message: 'Failed to preview cancellation' });
    }
});

router.put('/:id/cancel', authorize('admin'), async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);
        const { type = 'prorated', reason } = req.body; // type: 'prorated' | 'immediate'

        const result = await req.prisma.$transaction(async (prisma) => {
            // 1. Fetch Subscription with Payments and Plan
            const sub = await prisma.subscription.findUnique({
                where: { id: subscriptionId },
                include: {
                    plan: true,
                    payments: { include: { refunds: true } }
                }
            });

            if (!sub) throw new Error('Subscription not found');
            if (sub.status !== 'active') throw new Error('Subscription is not active');

            // 2. Financials Calculation (MATCH PREVIEW LOGIC)
            const paidTotal = sub.paidAmount || 0;
            const refundedTotal = sub.payments.reduce((acc, p) => acc + (p.refunds.reduce((s, r) => s + r.amount, 0)), 0);

            // 3. Usage Calculation (Calendar Days)
            const now = new Date();
            const start = new Date(sub.startDate);
            const totalDuration = sub.plan.duration;

            let usedDays = 0;
            if (now > start) {
                const diffTime = Math.abs(now - start);
                usedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            if (usedDays > totalDuration) usedDays = totalDuration;
            if (usedDays < 0) usedDays = 0;

            const totalPrice = sub.price !== null ? sub.price : sub.plan.price;
            const dailyRate = totalPrice / totalDuration;
            let usedAmount = usedDays * dailyRate;

            if (usedAmount > paidTotal) usedAmount = paidTotal;

            // 4. Calculate Refundable
            let refundableAmount = paidTotal - refundedTotal - usedAmount;
            if (refundableAmount < 0) refundableAmount = 0;

            console.log(`[CANCEL] Sub ${sub.id}: Paid=${paidTotal}, Used=${usedAmount} (${usedDays} days), Refundable=${refundableAmount}`);

            // 5. Execute Refund
            if (type === 'prorated' && refundableAmount > 0) {
                let shiftId = req.activeShift?.id;
                if (!shiftId) {
                    // Admin Fallback
                    const userShift = await prisma.pOSShift.findFirst({
                        where: { openedBy: req.user.id, closedAt: null }
                    });
                    if (userShift) shiftId = userShift.id;
                }
                if (!shiftId) throw new Error('Active shift required to process refund');

                // Attach to latest payment
                const payments = sub.payments.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
                if (payments.length === 0) throw new Error('No payments found for this subscription');

                await prisma.refund.create({
                    data: {
                        paymentId: payments[0].id,
                        amount: refundableAmount,
                        reason: `Prorated Cancellation (${usedDays} days used)`,
                        shiftId: shiftId,
                        createdBy: req.user.id
                    }
                });

                await prisma.payment.update({
                    where: { id: payments[0].id },
                    data: { refundedTotal: { increment: refundableAmount } }
                });
            }

            // 6. Close Subscription
            const updated = await prisma.subscription.update({
                where: { id: subscriptionId },
                data: {
                    status: 'cancelled',
                    endDate: now,
                    usedNonRefundableAmount: usedAmount,
                    canceledAt: now,
                    canceledById: req.user.id,
                    cancelReason: reason || (type === 'prorated' ? 'Prorated Cancellation' : 'Immediate Cancellation'),
                    cancelSource: 'manual',
                    alertAcknowledged: false // ENSURE it shows up as NEW alert
                }
            });

            // 7. Log
            await prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'CANCEL_SUBSCRIPTION',
                    entityType: 'Subscription',
                    entityId: sub.id,
                    details: JSON.stringify({ type, usedDays, usedAmount, refunded: type === 'prorated' ? refundableAmount : 0 })
                }
            });

            return { updated, refundAmount: type === 'prorated' ? refundableAmount : 0 };
        });

        res.json({
            success: true,
            message: `Subscription cancelled. Refund: ${result.refundAmount.toFixed(2)}`,
            data: result.updated
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(400).json({ // 400 for logic errors
            success: false,
            message: error.message || 'Failed to cancel subscription'
        });
    }
});

/**
 * GET /api/subscriptions/expired
 * Get all expired or due subscriptions for alerts
 */
router.get('/expired', requireAnyPermission('subscriptions.view', 'alerts.view'), async (req, res) => {
    try {
        const { range = 'all' } = req.query; // all, unacknowledged
        const now = new Date();

        const where = {
            OR: [
                { status: 'expired' },
                { status: 'cancelled' },
                { status: 'ended' },
                { status: 'active', endDate: { lte: now } }
            ]
        };

        if (range === 'unacknowledged') {
            where.alertAcknowledged = false;
        }

        const rawSubscriptions = await req.prisma.subscription.findMany({
            where,
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                },
                plan: true
            },
            orderBy: { endDate: 'desc' }
        });

        const subscriptions = rawSubscriptions.map(sub => {
            const end = new Date(sub.endDate);
            const overdueDays = Math.max(0, Math.floor((now - end) / (1000 * 60 * 60 * 24)));

            return {
                ...sub,
                overdueDays,
                alert: {
                    acknowledged: sub.alertAcknowledged,
                    acknowledgedAt: sub.alertAcknowledgedAt,
                    acknowledgedBy: sub.alertAcknowledgedBy
                }
            };
        });

        res.json({
            success: true,
            data: subscriptions
        });

    } catch (error) {
        console.error('Get expired subscriptions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch expired subscriptions' });
    }
});

/**
 * POST /api/subscriptions/:id/acknowledge
 * Mark a subscription alert as reviewed
 */
router.post('/:id/acknowledge', requireAnyPermission('subscriptions.view', 'alerts.view'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { acknowledged = true } = req.body;

        await req.prisma.subscription.update({
            where: { id },
            data: {
                alertAcknowledged: acknowledged,
                alertAcknowledgedAt: acknowledged ? new Date() : null,
                alertAcknowledgedBy: acknowledged ? req.user.id : null
            }
        });

        res.json({
            success: true,
            message: 'Alert status updated'
        });
    } catch (error) {
        console.error('Acknowledge error:', error);
        res.status(500).json({ success: false, message: 'Failed to update alert status' });
    }
});

/**
 * POST /api/subscriptions/acknowledge-all
 * Mark all expired subscriptions as reviewed for the current user/shift
 */
router.post('/acknowledge-all', requireAnyPermission('subscriptions.view', 'alerts.view'), async (req, res) => {
    try {
        const now = new Date();
        await req.prisma.subscription.updateMany({
            where: {
                OR: [
                    { status: 'expired' },
                    { status: 'cancelled' },
                    { status: 'ended' },
                    { status: 'active', endDate: { lte: now } }
                ],
                alertAcknowledged: false
            },
            data: {
                alertAcknowledged: true,
                alertAcknowledgedAt: now,
                alertAcknowledgedBy: req.user.id
            }
        });

        res.json({
            success: true,
            message: 'All current alerts marked as reviewed'
        });
    } catch (error) {
        console.error('Acknowledge all error:', error);
        res.status(500).json({ success: false, message: 'Failed to acknowledge alerts' });
    }
});

/**
 * GET /api/subscriptions/expiring
 * Get subscriptions expiring soon
 */
router.get('/expiring/soon', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);

        const subscriptions = await req.prisma.subscription.findMany({
            where: {
                status: 'active',
                endDate: {
                    lte: futureDate,
                    gte: new Date()
                }
            },
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                },
                plan: true
            },
            orderBy: { endDate: 'asc' }
        });

        res.json({
            success: true,
            data: subscriptions
        });

    } catch (error) {
        console.error('Get expiring subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expiring subscriptions'
        });
    }
});

module.exports = router;
