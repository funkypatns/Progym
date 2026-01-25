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
const { normalizePaymentMethod, resolvePaymentReference, recordPaymentTransaction } = require('../services/paymentService');
const { createReceipt } = require('../services/receiptService');
const { roundMoney, clampMoney } = require('../utils/money');

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
 * GET /api/subscriptions
 * Get all subscriptions with filters
 */
router.get('/', async (req, res) => {
    try {
        const { status, memberId, page = 1, limit = 20, distinctMembers } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;
        if (memberId) where.memberId = parseInt(memberId);

        let [rawSubscriptions, total] = await Promise.all([
            req.prisma.subscription.findMany({
                where,
                // If filtering by distinct members, we might need to fetch more and filter in memory 
                // OR use a raw query. For safety/Simplicity now: fetch standard page, but if param is set we need to rethink.
                // BETTER: If distinctMembers is set, we need to GROUP BY memberId.
                // Prisma doesn't support easy "Distinct On" with partial select easily in all DBs.
                // Strategy: If distinctMembers=true, we fetch ALL relevant subs (sorted by date) then dedupe in JS, then paginate.
                // Warning: This is heavy if there are millions. 
                // Optimization: Fetch only ID/MemberID first?
                // For Gym System (< 1000 active): In-memory dedupe of "Latest 1000" is fine.
                skip: distinctMembers === 'true' ? undefined : skip,
                take: distinctMembers === 'true' ? undefined : parseInt(limit),
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

        // DEDUPLICATION LOGIC
        if (distinctMembers === 'true') {
            const uniqueMap = new Map();
            rawSubscriptions.forEach(sub => {
                if (!uniqueMap.has(sub.memberId)) {
                    uniqueMap.set(sub.memberId, sub);
                } else {
                    // We already have one. Since we sorted by createdAt DESC, the first one we saw IS the latest.
                    // However, we might want to prioritize 'active' over 'expired' if dates are close? 
                    // No, createdAt DESC is the standard "Latest".
                }
            });
            const uniqueSubs = Array.from(uniqueMap.values());

            // Re-apply pagination manually since we fetched all
            total = uniqueSubs.length;
            const start = (parseInt(page) - 1) * parseInt(limit);
            rawSubscriptions = uniqueSubs.slice(start, start + parseInt(limit));
        }

        // Calculate days remaining and payment status
        const subscriptions = rawSubscriptions.map(sub => {
            const now = new Date();
            const end = new Date(sub.endDate);
            const diffTime = end - now;
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const total = sub.price != null ? sub.price : sub.plan.price;
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
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or greater'),
    body('paidAmount').optional().isFloat({ min: 0 }).withMessage('Paid amount must be 0 or greater'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be 0 or greater'),
    body('paymentStatus').optional().isIn(['paid', 'partial', 'unpaid']).withMessage('Invalid payment status'),
    body('method').optional().isIn(['cash', 'card', 'transfer', 'other']).withMessage('Invalid payment method')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const firstError = errors.array()[0];
            return res.status(400).json({
                success: false,
                message: firstError?.msg || 'Validation error',
                errors: errors.array()
            });
        }

        // 1. RBAC Check (Inline to handle complex AND logic if needed, or strictly enforcement)
        // User needs 'subscriptions.create' AND 'payments.create' if there is a payment
        if ((req.user.role || '').toLowerCase() !== 'admin') {
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
        const parsedMemberId = parseInt(memberId, 10);
        const parsedPlanId = parseInt(planId, 10);
        if (!Number.isInteger(parsedMemberId) || !Number.isInteger(parsedPlanId)) {
            return res.status(400).json({
                success: false,
                message: 'Member ID and Plan ID must be valid numbers'
            });
        }

        const normalizedMethod = normalizePaymentMethod(method);

        // 2. Logic & Data Prep
        const plan = await req.prisma.subscriptionPlan.findUnique({ where: { id: parsedPlanId } });
        if (!plan) return res.status(404).json({ success: false, message: 'Subscription plan not found' });

        const member = await req.prisma.member.findUnique({ where: { id: parsedMemberId } });
        if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

        const rawPrice = req.body.price;
        const parsedPrice = rawPrice !== undefined && rawPrice !== null && rawPrice !== ''
            ? parseFloat(rawPrice)
            : null;
        if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '' && !Number.isFinite(parsedPrice)) {
            return res.status(400).json({ success: false, message: 'Invalid price' });
        }

        const numericDiscount = discount ? parseFloat(discount) : 0;
        if (!Number.isFinite(numericDiscount)) {
            return res.status(400).json({ success: false, message: 'Invalid discount' });
        }

        const basePrice = parsedPrice !== null ? parsedPrice : plan.price;
        if (numericDiscount > basePrice) {
            return res.status(400).json({ success: false, message: 'Discount cannot exceed price' });
        }
        const fullPrice = clampMoney(basePrice - numericDiscount);

        let initialPaid = 0;
        // Fix: Prioritize explicit paidAmount if valid, otherwise fallback to plan price for 'paid' status
        if (paidAmount !== undefined && paidAmount !== null && !isNaN(parseFloat(paidAmount))) {
            initialPaid = parseFloat(paidAmount);
        } else if (paymentStatus === 'paid') {
            initialPaid = fullPrice;
        } else if (paymentStatus === 'partial' && paidAmount) {
            // Fallback for partial if not caught above
            initialPaid = parseFloat(paidAmount);
        }

        const numericPaidAmount = roundMoney(Number.isFinite(initialPaid) ? initialPaid : 0);
        if (numericPaidAmount > fullPrice) {
            return res.status(400).json({
                success: false,
                message: 'Paid amount cannot exceed total price'
            });
        }

        let computedPaymentStatus = 'unpaid';
        if (fullPrice === 0) {
            computedPaymentStatus = 'paid';
        } else if (numericPaidAmount >= fullPrice) {
            computedPaymentStatus = 'paid';
        } else if (numericPaidAmount > 0) {
            computedPaymentStatus = 'partial';
        }

        const safeRef = numericPaidAmount > 0
            ? resolvePaymentReference(normalizedMethod, externalReference, transactionRef)
            : null;

        if (normalizedMethod !== 'cash' && numericPaidAmount > 0 && !safeRef) {
            return res.status(400).json({
                success: false,
                message: 'Transaction reference is required for non-cash payments'
            });
        }

        if (process.env.NODE_ENV !== 'production') {
            console.info('[SUBSCRIPTIONS][CREATE]', {
                userId: req.user?.id,
                memberId: parsedMemberId,
                planId: parsedPlanId,
                method: normalizedMethod,
                paidAmount: numericPaidAmount,
                paymentStatus: computedPaymentStatus,
                price: fullPrice,
                hasReference: Boolean(safeRef)
            });
        }

        // 4. Create Subscription (Transaction)
        const result = await req.prisma.$transaction(async (prisma) => {
            // Safety: Check if an identical active subscription already exists (Race condition check)
            const existing = await prisma.subscription.findFirst({
                where: {
                    memberId: parsedMemberId,
                    planId: parsedPlanId,
                    status: 'active',
                    startDate: startDate ? new Date(startDate) : { lte: new Date() },
                    endDate: { gte: new Date() }
                }
            });

            if (existing) {
                // If it exists and was created very recently (e.g. within 5 seconds), 
                // it's likely a double-post. Return it instead of creating a new one.
                const fiveSecondsAgo = new Date(Date.now() - 5000);
                if (existing.createdAt > fiveSecondsAgo) {
                    console.log(`[SUBS] Duplicate detected for member ${memberId}. Returning existing sub ${existing.id}`);
                    return existing;
                }
            }

            // STRICT RULE: Cannot assign new subscription if one is already active
            const activeSub = await prisma.subscription.findFirst({
                where: {
                    memberId: parsedMemberId,
                    status: 'active'
                },
                include: { plan: true }
            });

            if (activeSub) {
                // Check if it's a race-condition duplicate (created just now) or a legitimate existing one
                // If it's a race duplicate, we might want to return it (idempotency), 
                // BUT the requirement says "Return HTTP 409".
                // To be safe and compliant:
                const isRace = activeSub.createdAt > new Date(Date.now() - 5000) && activeSub.planId === parsedPlanId;

                if (isRace) {
                    console.log(`[SUBS] Idempotency: Returning existing sub ${activeSub.id}`);
                    return activeSub;
                }

                throw new Error(`CONFLICT: Member already has an active subscription (${activeSub.plan.name}).`);
            }

            const start = startDate ? new Date(startDate) : new Date();
            const end = new Date(start);
            end.setDate(end.getDate() + plan.duration);

            const remainingAmount = clampMoney(fullPrice - numericPaidAmount);
            const sub = await prisma.subscription.create({
                data: {
                    memberId: parsedMemberId,
                    planId: parsedPlanId,
                    startDate: start,
                    endDate: end,
                    status: 'active',
                    price: fullPrice,
                    paidAmount: roundMoney(numericPaidAmount),
                    remainingAmount,
                    paymentStatus: computedPaymentStatus,
                    discount: numericDiscount,
                    notes: notes || null
                },
                include: { member: true, plan: true }
            });

            // 5. Unified Payment & Invoice Logic
            // Detect shift & collector info
            let finalCreatedBy = req.user.id;
            let finalCollectorName = `${req.user.firstName} ${req.user.lastName}`;

            if ((req.user.role || '').toLowerCase() === 'admin' && collectorId) {
                finalCreatedBy = parseInt(collectorId);
                // Try to find collector name if provided in body or just use snapshot
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

            const totalPrice = fullPrice;
            const paidNow = numericPaidAmount;
            let createdPayment = null;

            // Step A: Create "Receipt" for money actually received now
            if (paidNow > 0) {
                const paymentResult = await recordPaymentTransaction(prisma, {
                    memberId: sub.memberId,
                    subscriptionId: sub.id,
                    amount: paidNow,
                    method: normalizedMethod,
                    status: 'completed',
                    notes: `${computedPaymentStatus === 'paid' ? 'Full' : 'Partial'} subscription payment${notes ? ` - ${notes}` : ''}`,
                    shiftId: shiftId,
                    createdBy: finalCreatedBy,
                    collectorName: finalCollectorName,
                    externalReference: safeRef
                });
                createdPayment = paymentResult.payment;
            }

            // Step B: Create "Invoice" (Pending Payment) for any remaining balance
            if (paidNow < totalPrice) {
                const remaining = totalPrice - paidNow;
                await recordPaymentTransaction(prisma, {
                    memberId: sub.memberId,
                    subscriptionId: sub.id,
                    amount: remaining,
                    method: 'other', // Invoice doesn't have a method yet
                    status: 'pending',
                    notes: `Remaining balance for ${plan.name} subscription`,
                    shiftId: shiftId,
                    createdBy: finalCreatedBy,
                    collectorName: finalCollectorName
                }, { receiptSuffix: '-INV' });
            }

            if (createdPayment) {
                await createReceipt(prisma, {
                    transactionType: 'payment',
                    transactionId: createdPayment.id,
                    paymentMethod: createdPayment.method,
                    customerId: sub.memberId,
                    customerName: sub.member ? `${sub.member.firstName} ${sub.member.lastName}` : null,
                    customerPhone: sub.member?.phone || null,
                    customerCode: sub.member?.memberId || null,
                    staffId: finalCreatedBy,
                    staffName: finalCollectorName,
                    items: [
                        {
                            type: 'subscription',
                            name: plan.name,
                            qty: 1,
                            unitPrice: totalPrice,
                            lineTotal: totalPrice,
                            duration: plan.duration,
                            startDate: sub.startDate,
                            endDate: sub.endDate
                        }
                    ],
                    totals: {
                        subtotal: totalPrice,
                        discount: numericDiscount || 0,
                        tax: 0,
                        total: totalPrice,
                        paid: paidNow,
                        paidToDate: sub.paidAmount || paidNow,
                        remaining: remainingAmount,
                        change: 0
                    },
                    notes: createdPayment.notes || null,
                    createdAt: createdPayment.paidAt || createdPayment.createdAt
                });
            } else {
                await createReceipt(prisma, {
                    transactionType: 'subscription',
                    transactionId: sub.id,
                    paymentMethod: normalizedMethod,
                    customerId: sub.memberId,
                    customerName: sub.member ? `${sub.member.firstName} ${sub.member.lastName}` : null,
                    customerPhone: sub.member?.phone || null,
                    customerCode: sub.member?.memberId || null,
                    staffId: finalCreatedBy,
                    staffName: finalCollectorName,
                    items: [
                        {
                            type: 'subscription',
                            name: plan.name,
                            qty: 1,
                            unitPrice: totalPrice,
                            lineTotal: totalPrice,
                            duration: plan.duration,
                            startDate: sub.startDate,
                            endDate: sub.endDate
                        }
                    ],
                    totals: {
                        subtotal: totalPrice,
                        discount: numericDiscount || 0,
                        tax: 0,
                        total: totalPrice,
                        paid: 0,
                        paidToDate: 0,
                        remaining: totalPrice,
                        change: 0
                    },
                    notes: notes || null,
                    createdAt: sub.createdAt
                });
            }
            return { ...sub, payment: createdPayment };
        });

        // Log Activity
        try {
            await req.prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'CREATE_SUBSCRIPTION',
                    entityType: 'Subscription',
                    entityId: result.id,
                    details: JSON.stringify({ planName: plan.name, amount: numericPaidAmount })
                }
            });
        } catch (logError) {
            console.warn('[SUBSCRIPTIONS][CREATE] Activity log failed:', logError.message);
        }

        res.status(201).json({ success: true, message: 'Subscription created', data: result });

    } catch (error) {
        const errorInfo = {
            message: error.message,
            code: error.code,
            userId: req.user?.id,
            memberId: req.body?.memberId,
            planId: req.body?.planId
        };
        if (process.env.NODE_ENV === 'development') {
            console.error('Create subscription error:', error);
        } else {
            console.error('Create subscription error:', errorInfo);
        }

        if (error.message && error.message.includes('CONFLICT:')) {
            return res.status(409).json({
                success: false,
                message: error.message.replace('CONFLICT: ', '')
            });
        }

        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'Duplicate record detected. Please try again.'
            });
        }

        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Invalid reference data. Please refresh and try again.'
            });
        }

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
        const normalizedMethod = normalizePaymentMethod(method);

        const result = await req.prisma.$transaction(async (prisma) => {
            // 1. Validate Previous Subscription
            const previousSub = await prisma.subscription.findUnique({
                where: { id: previousSubscriptionId },
                include: { plan: true }
            });

            if (!previousSub) throw new Error('Previous subscription not found');

            // 1.5 Safety: Check if this renewal already happened (Race condition)
            const existingNewSub = await prisma.subscription.findFirst({
                where: {
                    memberId: previousSub.memberId,
                    planId: parseInt(planId),
                    status: 'active',
                    createdAt: { gte: new Date(Date.now() - 5000) } // Created in last 5s
                }
            });

            if (existingNewSub) {
                console.log(`[SUBS] Duplicate renewal detected for member ${previousSub.memberId}. Returning existing.`);
                return existingNewSub;
            }


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

            const numericPaidAmount = roundMoney(initialPaid);

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
                    paidAmount: numericPaidAmount,
                    notes: notes || `Renewal of prev sub #${previousSubscriptionId}`,
                    // usedNonRefundableAmount starts at 0 for new sub
                },
                include: {
                    member: true,
                    plan: true
                }
            });

            // 5. Unified Payment Logic for Renewal
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

            const fullPrice = roundMoney(newPlan.price);
            const paidNow = roundMoney(numericPaidAmount);

            // Step A: Receipt for actual money
            let createdPayment = null;
            if (paidNow > 0) {
                const paymentResult = await recordPaymentTransaction(prisma, {
                    memberId: newSub.memberId,
                    subscriptionId: newSub.id,
                    amount: paidNow,
                    method: normalizedMethod,
                    status: 'completed',
                    notes: `Renewal Payment: ${paymentStatus === 'paid' ? 'Full' : 'Partial'}` + (externalReference ? ` (Ref: ${externalReference})` : '') + (notes ? ` - ${notes}` : ''),
                    shiftId: shiftId,
                    createdBy: finalCreatedBy,
                    collectorName: finalCollectorName,
                    externalReference: externalReference
                });
                createdPayment = paymentResult.payment;
            }

            // Step B: Invoice for remaining balance
            if (paidNow < fullPrice) {
                await recordPaymentTransaction(prisma, {
                    memberId: newSub.memberId,
                    subscriptionId: newSub.id,
                    amount: roundMoney(fullPrice - paidNow),
                    method: 'other',
                    status: 'pending',
                    notes: `Remaining balance for ${newPlan.name} renewal`,
                    shiftId: shiftId,
                    createdBy: finalCreatedBy,
                    collectorName: finalCollectorName
                }, { receiptSuffix: '-INV' });
            }

            if (createdPayment) {
                await createReceipt(prisma, {
                    transactionType: 'payment',
                    transactionId: createdPayment.id,
                    paymentMethod: createdPayment.method,
                    customerId: newSub.memberId,
                    customerName: newSub.member ? `${newSub.member.firstName} ${newSub.member.lastName}` : null,
                    customerPhone: newSub.member?.phone || null,
                    customerCode: newSub.member?.memberId || null,
                    staffId: finalCreatedBy,
                    staffName: finalCollectorName,
                    items: [
                        {
                            type: 'subscription',
                            name: newPlan.name,
                            qty: 1,
                            unitPrice: fullPrice,
                            lineTotal: fullPrice,
                            duration: newPlan.duration,
                            startDate: newSub.startDate,
                            endDate: newSub.endDate
                        }
                    ],
                    totals: {
                        subtotal: fullPrice,
                        discount: 0,
                        tax: 0,
                        total: fullPrice,
                        paid: paidNow,
                        paidToDate: newSub.paidAmount || paidNow,
                        remaining: roundMoney(fullPrice - paidNow),
                        change: 0
                    },
                    notes: createdPayment.notes || null,
                    createdAt: createdPayment.paidAt || createdPayment.createdAt
                });
            } else {
                await createReceipt(prisma, {
                    transactionType: 'subscription',
                    transactionId: newSub.id,
                    paymentMethod: normalizedMethod,
                    customerId: newSub.memberId,
                    customerName: newSub.member ? `${newSub.member.firstName} ${newSub.member.lastName}` : null,
                    customerPhone: newSub.member?.phone || null,
                    customerCode: newSub.member?.memberId || null,
                    staffId: finalCreatedBy,
                    staffName: finalCollectorName,
                    items: [
                        {
                            type: 'subscription',
                            name: newPlan.name,
                            qty: 1,
                            unitPrice: fullPrice,
                            lineTotal: fullPrice,
                            duration: newPlan.duration,
                            startDate: newSub.startDate,
                            endDate: newSub.endDate
                        }
                    ],
                    totals: {
                        subtotal: fullPrice,
                        discount: 0,
                        tax: 0,
                        total: fullPrice,
                        paid: 0,
                        paidToDate: 0,
                        remaining: fullPrice,
                        change: 0
                    },
                    notes: notes || null,
                    createdAt: newSub.createdAt
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
 * PUT /api/subscriptions/:id/toggle-pause
 * Pause or Resume subscription
 */
router.put('/:id/toggle-pause', async (req, res) => {
    try {
        const subscriptionId = parseInt(req.params.id);

        const subscription = await req.prisma.subscription.findUnique({
            where: { id: subscriptionId }
        });

        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }

        const isPausing = !subscription.isPaused;
        const now = new Date();

        let updateData = {};

        // Parse existing history
        let history = [];
        try {
            if (subscription.pauseHistory) {
                history = JSON.parse(subscription.pauseHistory);
            }
        } catch (e) { history = []; }

        if (isPausing) {
            // PAUSE ACTION
            if (subscription.status !== 'active') {
                return res.status(400).json({ success: false, message: 'Can only pause active subscriptions' });
            }

            // Add new "open" history entry
            history.push({ start: now.toISOString(), end: null, reason: req.body.reason || 'Manual Pause' });

            updateData = {
                isPaused: true,
                status: 'paused', // Visual status
                pauseHistory: JSON.stringify(history),
                frozenAt: now // Legacy support if needed
            };
        } else {
            // RESUME ACTION
            if (!subscription.isPaused) {
                return res.status(400).json({ success: false, message: 'Subscription is not paused' });
            }

            // Find the open entry (end is null)
            const lastEntryIndex = history.findIndex(h => h.end === null);
            if (lastEntryIndex === -1) {
                // Should not happen if data integrity is good, but recover:
                history.push({ start: now.toISOString(), end: now.toISOString(), note: 'Auto-closed orphan pause' });
            } else {
                const entry = history[lastEntryIndex];
                entry.end = now.toISOString();

                // Calculate duration
                const start = new Date(entry.start);
                const durationMs = now - start;
                const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

                entry.durationDays = durationDays;
                history[lastEntryIndex] = entry; // Update

                // EXTEND END DATE
                const currentEndDate = new Date(subscription.endDate);
                currentEndDate.setDate(currentEndDate.getDate() + durationDays);
                updateData.endDate = currentEndDate;
            }

            updateData = {
                isPaused: false,
                status: 'active',
                pauseHistory: JSON.stringify(history),
                frozenAt: null, // Clear legacy
                frozenUntil: null
            };
        }

        const updated = await req.prisma.subscription.update({
            where: { id: subscriptionId },
            data: updateData
        });

        // Log
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: isPausing ? 'PAUSE_SUBSCRIPTION' : 'RESUME_SUBSCRIPTION',
                entityType: 'Subscription',
                entityId: subscriptionId,
                details: JSON.stringify({ isPaused: isPausing })
            }
        });

        res.json({
            success: true,
            message: isPausing ? 'Subscription paused' : 'Subscription resumed (End date extended)',
            data: updated
        });

    } catch (error) {
        console.error('Toggle pause error:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle pause' });
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

        const totalPrice = sub.price != null ? sub.price : sub.plan.price;
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

            const totalPrice = sub.price != null ? sub.price : sub.plan.price;
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

/**
 * PUT /api/subscriptions/:id/toggle-pause
 * Freeze/Unfreeze a subscription
 */
router.put('/:id/toggle-pause', async (req, res) => {
    try {
        const { id } = req.params;
        const sub = await req.prisma.subscription.findUnique({ where: { id: parseInt(id) } });

        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

        const isPaused = sub.isPaused || false;
        const now = new Date();

        if (!isPaused) {
            // FREEZE
            const history = Array.isArray(sub.pauseHistory) ? sub.pauseHistory : [];
            history.push({ pausedAt: now, resumedAt: null });

            await req.prisma.subscription.update({
                where: { id: parseInt(id) },
                data: {
                    isPaused: true,
                    // status: 'paused', // Optional: Keep status as active but flag isPaused, or use 'paused'
                    pauseHistory: history
                }
            });

            res.json({ success: true, message: 'Subscription frozen', isPaused: true });
        } else {
            // UNFREEZE
            const history = Array.isArray(sub.pauseHistory) ? sub.pauseHistory : [];
            let lastEntry = history[history.length - 1];

            let daysToExtend = 0;
            if (lastEntry && !lastEntry.resumedAt) {
                lastEntry.resumedAt = now;
                const pauseStart = new Date(lastEntry.pausedAt);
                const diffTime = Math.abs(now - pauseStart);
                daysToExtend = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            const currentEnd = new Date(sub.endDate);
            const newEnd = new Date(currentEnd);
            newEnd.setDate(newEnd.getDate() + daysToExtend);

            await req.prisma.subscription.update({
                where: { id: parseInt(id) },
                data: {
                    isPaused: false,
                    // status: 'active',
                    endDate: newEnd,
                    pauseHistory: history
                }
            });

            res.json({ success: true, message: `Subscription resumed. Extended by ${daysToExtend} days.`, isPaused: false, newEndDate: newEnd });
        }

    } catch (error) {
        console.error('Toggle pause error:', error);
        res.status(500).json({ success: false, message: 'Failed to toggle pause' });
    }
});

module.exports = router;
