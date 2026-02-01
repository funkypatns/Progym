/**
 * ============================================
 * PAYMENT ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireActiveShift, requirePermission } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');
const { normalizePaymentMethod, resolvePaymentReference, recordPaymentTransaction } = require('../services/paymentService');
const CommissionService = require('../services/commissionService');
const { createReceipt, buildTransactionId, parseReceiptJson } = require('../services/receiptService');
const { roundMoney, clampMoney } = require('../utils/money');

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
/**
 * Generate unique receipt number
 * Format: RCP-YYYYMM-HHMMSS-RAND
 */
function generateReceiptNumber() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const time = String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0') + String(date.getSeconds()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RCP-${year}${month}-${time}-${random}`;
}

const RECEIPT_INIT_MESSAGE = 'Receipts tables are not initialized. Run prisma migrate dev & prisma generate.';

const buildPaymentResponsePayload = async (payment, prisma, receiptError = null) => {
    const transactionId = buildTransactionId('payment', payment.id);
    let parsedReceipt = null;
    try {
        const receiptRecord = await prisma.receipt.findUnique({
            where: { transactionId }
        });
        parsedReceipt = receiptRecord ? parseReceiptJson(receiptRecord) : null;
    } catch (err) {
        console.warn('[PAYMENTS] Receipt lookup failed (maybe migrations missing):', err.message);
        if (!receiptError) {
            receiptError = {
                status: 'not_initialized',
                message: RECEIPT_INIT_MESSAGE
            };
        }
    }
    let status = receiptError?.status || (parsedReceipt ? 'ready' : 'missing');
    let message = receiptError?.message || '';
    if (!message) {
        if (status === 'not_initialized') {
            message = RECEIPT_INIT_MESSAGE;
        } else if (status === 'missing' && parsedReceipt) {
            status = 'ready';
            message = '';
        }
    }

    return {
        ...payment,
        paymentId: payment.id,
        transactionId,
        receipt: parsedReceipt,
        receiptCreated: Boolean(parsedReceipt),
        receiptStatus: status,
        receiptMessage: message
    };
};

/**
 * GET /api/payments
 * Get all payments
 */
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, memberId, status, startDate, endDate } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        const rawTypeFilter = String(req.query.type || '').trim().toUpperCase();
        const debugTypeFilter = process.env.DEBUG_PAYMENT_TYPE_FILTER === '1';

        const userRole = (req.user.role || '').toLowerCase();
        const privilegedRoles = ['admin', 'owner', 'superadmin'];
        // RBAC: Non-privileged staff can ONLY see payments for their current open shift
        if (!privilegedRoles.includes(userRole)) {
            const openShift = await req.prisma.pOSShift.findFirst({
                where: {
                    openedBy: req.user.id,
                    closedAt: null
                }
            });

            // If no open shift, we just don't add the shiftId filter clause, 
            // but we MUST allow them to see their own payments (createdBy) or pending ones.
            
            where.OR = [
                { status: 'pending' },
                { createdBy: req.user.id } // Allow seeing own payments regardless of shift
            ];

            if (openShift) {
                where.OR.push({ shiftId: openShift.id });
            }
        }

        if (memberId) where.memberId = parseInt(memberId);
        if (status) where.status = status;

        // Type Filtering (session = appointmentId, subscription = subscriptionId)
        if (rawTypeFilter === 'SESSION') {
            where.appointmentId = { not: null };
        } else if (rawTypeFilter === 'SUBSCRIPTION') {
            where.subscriptionId = { not: null };
        }
        if (debugTypeFilter) {
            console.log(`[PAYMENTS] role=${userRole} type=${rawTypeFilter || 'ALL'} filters`, { appointment: where.appointmentId, subscription: where.subscriptionId });
        }


        if (startDate || endDate) {
            where.paidAt = {};
            if (startDate) where.paidAt.gte = new Date(startDate);
            if (endDate) where.paidAt.lte = new Date(endDate);
        }

        const [payments, total] = await Promise.all([
            req.prisma.payment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { paidAt: 'desc' },
                include: {
                    member: {
                        select: { id: true, memberId: true, firstName: true, lastName: true }
                    },
                    subscription: {
                        include: {
                            plan: true,
                            payments: {
                                select: { amount: true, status: true }
                            }
                        }
                    },
                    creator: {
                        select: { id: true, firstName: true, lastName: true, role: true }
                    },
                    appointment: {
                        include: {
                            payments: {
                                select: { amount: true, status: true }
                            },
                            coach: {
                                select: { id: true, firstName: true, lastName: true }
                            },
                            trainer: {
                                select: { id: true, name: true }
                            },
                            completedByEmployee: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        }
                    },
                    refunds: true
                }
            }),
            req.prisma.payment.count({ where })
        ]);

        if (debugTypeFilter) {
            console.log(`[PAYMENTS] returning ${payments.length} rows for role=${userRole} type=${rawTypeFilter || 'ALL'}`);
        }
        if (process.env.DEBUG_REPORTS === '1' && rawTypeFilter === 'SESSION') {
            console.log('[REPORTS][PAYMENTS] session payments', {
                startDate,
                endDate,
                count: payments.length
            });
        }
        res.json({
            success: true,
            data: {
                payments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payments'
        });
    }
});


// ============================================
// CARD PAYMENT REFERENCE VERIFICATION
// ============================================

/**
 * POST /api/payments/verify-reference
 * Pre-validate a card transaction reference before payment
 */
router.post('/verify-reference', async (req, res) => {
    try {
        const { reference, expectedAmount } = req.body;

        if (!reference || !reference.trim()) {
            return res.json({
                success: true,
                valid: false,
                duplicate: false,
                reason: 'Reference is required'
            });
        }

        const trimmedRef = reference.trim();

        // Check for duplicates
        const existing = await req.prisma.payment.findFirst({
            where: {
                OR: [
                    { externalReference: trimmedRef },
                    { transactionRef: trimmedRef }
                ]
            },
            select: {
                id: true,
                receiptNumber: true,
                paidAt: true
            }
        });

        if (existing) {
            return res.json({
                success: true,
                valid: false,
                duplicate: true,
                reason: 'Reference already used',
                existingReceipt: existing.receiptNumber,
                existingDate: existing.paidAt
            });
        }

        // Reference is valid and unique
        res.json({
            success: true,
            valid: true,
            duplicate: false,
            reference: trimmedRef
        });

    } catch (error) {
        console.error('[PAYMENTS] Reference verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify reference'
        });
    }
});


/**
 * POST /api/payments
 * Record a new payment
 */
router.post('/', requirePermission('payments.create'), [
    body('memberId').isInt().withMessage('Valid member ID is required'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('method').isIn(['cash', 'card', 'transfer', 'other']).withMessage('Invalid payment method')
], async (req, res) => {
    let idempotencyKey = null;
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('[PAYMENTS POST] Validation errors:', errors.array());
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { memberId, subscriptionId, appointmentId, amount, method, notes, transactionRef, machineId, collectorId, collectorName, verificationMode, posAmountVerified } = req.body;
        const paymentType = String(req.body.type || 'subscription').toLowerCase();
        const paymentMode = String(req.body.paymentMode || req.body.paymentType || '').toLowerCase();
        const normalizedPaymentMode = ['partial', 'full'].includes(paymentMode) ? paymentMode : null;
        const rawAmount = amount !== undefined && amount !== null && amount !== '' ? Number(amount) : null;
        if (rawAmount !== null && !Number.isFinite(rawAmount)) {
            return res.status(400).json({ success: false, message: 'Invalid payment amount' });
        }
        const amountValue = rawAmount !== null ? roundMoney(rawAmount) : null;

        idempotencyKey = String(req.header('Idempotency-Key') || '').trim();
        if (!idempotencyKey) {
            const fallbackParts = [
                'AUTO',
                memberId ?? 'member',
                subscriptionId ?? 'subscription',
                normalizedPaymentMode || 'mode',
                method || 'method',
                amountValue ?? 'amount'
            ];
            idempotencyKey = fallbackParts.join('-');
        }

        if (idempotencyKey) {
            let existingPayment = null;
            try {
                existingPayment = await req.prisma.payment.findUnique({
                    where: { idempotencyKey }
                });
            } catch (lookupErr) {
                console.warn('[PAYMENTS] Failed to lookup idempotency key:', lookupErr.message);
            }
            if (existingPayment) {
                const existingPayload = await buildPaymentResponsePayload(existingPayment, req.prisma);
                return res.json({
                    success: true,
                    message: 'Payment already processed',
                    data: existingPayload
                });
            }
        }


        let shiftId = null;
        let finalCreatedBy = req.user.id;
        let finalCollectorName = `${req.user.firstName} ${req.user.lastName}`;

        // Admin can override collector
        if (req.user.role === 'admin' && collectorId) {
            finalCreatedBy = parseInt(collectorId);
            if (collectorName) finalCollectorName = collectorName;

            // Validate collector exists
            const collector = await req.prisma.user.findUnique({
                where: { id: finalCreatedBy }
            });
            if (!collector) {
                return res.status(404).json({ success: false, message: 'Collector employee not found' });
            }
        }

        // Validate member exists
        const member = await req.prisma.member.findUnique({
            where: { id: parseInt(memberId) }
        });
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        const isSubscriptionPayment = paymentType === 'subscription' || normalizedPaymentMode;
        if (isSubscriptionPayment && (!subscriptionId || !Number.isInteger(parseInt(subscriptionId)))) {
            return res.status(400).json({
                success: false,
                message: 'Subscription is required to record this payment'
            });
        }

        if (normalizedPaymentMode && subscriptionId && memberId) {
            const recentWindowMs = 4000;
            const recentWhere = {
                memberId: parseInt(memberId),
                subscriptionId: parseInt(subscriptionId),
                status: 'completed',
                paidAt: { gte: new Date(Date.now() - recentWindowMs) }
            };
            if (Number.isInteger(finalCreatedBy)) {
                recentWhere.createdBy = finalCreatedBy;
            }
            const recentPayment = await req.prisma.payment.findFirst({
                where: recentWhere,
                orderBy: { paidAt: 'desc' }
            });
            if (recentPayment) {
                const existingPayload = await buildPaymentResponsePayload(recentPayment, req.prisma);
                return res.json({
                    success: true,
                    message: 'Payment already processed',
                    data: existingPayload
                });
            }
        }

        if (!isSubscriptionPayment && (amountValue === null || amountValue <= 0)) {
            return res.status(400).json({
                success: false,
                message: 'Payment amount must be greater than 0'
            });
        }

        // POS SHIFT ENFORCEMENT (Strict Business Rule)
        // 1. Check middleware attached shift
        // 2. If missing (e.g. admin bypass?), lookup active shift for this user
        // 3. FAIL if no open shift found.

        shiftId = req.activeShift?.id;

        if (!shiftId) {
            // Attempt manual lookup
            const userShift = await req.prisma.pOSShift.findFirst({
                where: {
                    openedBy: req.user.id,
                    closedAt: null
                }
            });

            if (userShift) {
                shiftId = userShift.id;
            } else {
                // REJECT: No open shift
                console.warn(`[PAYMENT REJECTED] User ${req.user.id} attempted payment without open shift.`);
                return res.status(403).json({
                    success: false,
                    message: 'Action denied. You must open a shift before recording payments.'
                });
            }
        }

        const normalizedMethod = normalizePaymentMethod(method);
        const safeRef = resolvePaymentReference(normalizedMethod, null, transactionRef);

        // Validate transaction reference for Card/Visa
        if ((normalizedMethod === 'card' || normalizedMethod === 'visa') && !safeRef) {
            console.error('[PAYMENTS POST] Missing transactionRef for card/visa');
            return res.status(400).json({
                success: false,
                message: 'Transaction reference is required for Card/Visa payments'
            });
        }

        // TRANSACTIONAL UPDATE
        const result = await req.prisma.$transaction(async (prisma) => {
            let resolvedAmount = amountValue;
            // 1. Subscription validation (do not mutate until payment is confirmed)
            if (subscriptionId) {
                const subIdInt = parseInt(subscriptionId);
                const memIdInt = parseInt(memberId);

                const subscription = await prisma.subscription.findFirst({
                    where: { id: subIdInt, memberId: memIdInt },
                    select: {
                        id: true,
                        paidAmount: true,
                        price: true,
                        plan: { select: { price: true } }
                    }
                });

                if (!subscription) throw new Error('SUBSCRIPTION_NOT_FOUND');

                const planPrice = subscription.price ?? subscription.plan?.price ?? 0;
                const currentPaid = roundMoney(subscription.paidAmount || 0);
                const remaining = clampMoney(planPrice - currentPaid);

                if (normalizedPaymentMode === 'full') {
                    if (remaining <= 0) {
                        throw new Error('ALREADY_PAID');
                    }
                    if (resolvedAmount === null || resolvedAmount <= 0) {
                        resolvedAmount = remaining;
                    } else if (Math.abs(resolvedAmount - remaining) > 0.01) {
                        throw new Error(`FULL_PAYMENT_MISMATCH:${remaining}`);
                    }
                } else if (normalizedPaymentMode === 'partial') {
                    if (resolvedAmount === null || resolvedAmount <= 0) {
                        throw new Error('PARTIAL_AMOUNT_REQUIRED');
                    }
                } else if (resolvedAmount === null || resolvedAmount <= 0) {
                    throw new Error('AMOUNT_REQUIRED');
                }

                if (resolvedAmount > remaining + 0.01) {
                    throw new Error(`OVERPAYMENT: Amount exceeds remaining balance (${remaining})`);
                }
            }

            // schema.prisma (Runtime mismatch workaround: transactionRef field unknown to client)
            // memberId Int
            // subscriptionId Int?
            // amount Float
            // method String
            // status String (@default("completed"))
            // receiptNumber String (@unique)
            // notes String?
            // shiftId Int?
            // createdBy Int?
            // collectorName String?

            // 3. Create Payment (shared service)
            const paymentResult = await recordPaymentTransaction(prisma, {
                memberId,
                subscriptionId,
                amount: resolvedAmount,
                method: normalizedMethod,
                status: 'completed',
                notes,
                shiftId,
                createdBy: finalCreatedBy,
                collectorName: finalCollectorName,
                externalReference: safeRef,
                transactionRef,
                verificationMode,
                posAmountVerified,
                appointmentId
            }, { idempotencyKey });
            const payment = paymentResult.payment;

            // 3.1 Process Commission is HANDLED BY SESSION COMPLETION ONLY.
            // DO NOT Add commission logic here. Subscription payments must NOT trigger commissions.

            // 4. Update subscription payment status if applicable
            if (subscriptionId) {
                const sub = await prisma.subscription.findUnique({
                    where: { id: parseInt(subscriptionId) },
                    include: { plan: true }
                });
                if (!sub) throw new Error('SUBSCRIPTION_NOT_FOUND');

                const totalPrice = roundMoney(sub.price ?? sub.plan?.price ?? 0);

                // Get all payments for this subscription
                const allPayments = await prisma.payment.findMany({
                    where: { subscriptionId: parseInt(subscriptionId), status: 'completed' },
                    select: { amount: true }
                });
                const totalPaid = roundMoney(allPayments.reduce((sum, p) => sum + (p.amount || 0), 0));

                // Update paidAmount on subscription
                // NEW: Also update remainingAmount and paymentStatus
                // Status logic: 
                const newRemaining = clampMoney(totalPrice - totalPaid);
                let newStatus = 'unpaid';
                if (totalPaid >= totalPrice - 0.01) newStatus = 'paid';
                else if (totalPaid > 0) newStatus = 'partial';

                await prisma.subscription.update({
                    where: { id: parseInt(subscriptionId) },
                    data: {
                        paidAmount: roundMoney(totalPaid),
                        remainingAmount: newRemaining,
                        paymentStatus: newStatus
                    }
                });

            }

            const paymentDetails = await prisma.payment.findUnique({
                where: { id: payment.id },
                include: {
                    member: {
                        select: { id: true, firstName: true, lastName: true, phone: true, memberId: true }
                    },
                    subscription: {
                        include: { plan: true }
                    },
                    creator: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            });

            const member = paymentDetails?.member;
            const subscription = paymentDetails?.subscription;
            const plan = subscription?.plan;
            const totalPrice = subscription?.price ?? plan?.price ?? payment.amount;
            const paidNow = Number(payment.amount || 0);
            const paidToDate = Number.isFinite(Number(subscription?.paidAmount)) ? Number(subscription.paidAmount) : paidNow;
            const remaining = Number.isFinite(Number(subscription?.remainingAmount)) ? Number(subscription.remainingAmount) : 0;
            const staffName = payment.collectorName || (paymentDetails?.creator ? `${paymentDetails.creator.firstName} ${paymentDetails.creator.lastName}` : 'System');

            const items = [];
            if (subscription) {
                items.push({
                    type: 'subscription',
                    name: plan?.name || 'Subscription',
                    qty: 1,
                    unitPrice: totalPrice,
                    lineTotal: totalPrice,
                    duration: plan?.duration,
                    startDate: subscription.startDate,
                    endDate: subscription.endDate
                });
            } else {
                items.push({
                    type: 'payment',
                    name: notes || 'Payment',
                    qty: 1,
                    unitPrice: paidNow,
                    lineTotal: paidNow
                });
            }

            let receiptError = null;
            try {
                await createReceipt(prisma, {
                    transactionType: 'payment',
                    transactionId: payment.id,
                    paymentMethod: payment.method,
                    customerId: member?.id,
                    customerName: member ? `${member.firstName} ${member.lastName}` : null,
                    customerPhone: member?.phone || null,
                    customerCode: member?.memberId || null,
                    staffId: payment.createdBy || null,
                    staffName,
                    items,
                    totals: {
                        subtotal: totalPrice,
                        discount: subscription?.discount || 0,
                        tax: 0,
                        total: totalPrice,
                        paid: paidNow,
                        paidToDate,
                        remaining,
                        change: 0
                    },
                    notes: payment.notes || null,
                    createdAt: payment.paidAt || payment.createdAt
                });
            } catch (receiptErr) {
                if (receiptErr?.code === 'RECEIPTS_NOT_READY') {
                    receiptError = {
                        status: 'not_initialized',
                        message: receiptErr.message
                    };
                } else {
                    console.error('[PAYMENTS] Receipt creation failed:', receiptErr);
                    receiptError = {
                        status: 'failed',
                        message: 'Failed to create receipt'
                    };
                }
            }

            // 5. Log Activity
            await prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'CREATE_PAYMENT',
                    entityType: 'Payment',
                    entityId: payment.id,
                    details: JSON.stringify({ amount: resolvedAmount, method, subscriptionId })
                }
            });

            return { payment, receiptError };
        });

        const payload = await buildPaymentResponsePayload(result.payment, req.prisma, result.receiptError);
        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: payload
        });

    } catch (error) {
        console.error('[PAYMENTS POST] Error Details:', {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack
        });

        // KNOWN ERRORS
        if (error.message === 'SUBSCRIPTION_NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Subscription not found or does not belong to member' });
        }
        if (error.message === 'ALREADY_PAID') {
            return res.status(400).json({ success: false, message: 'Subscription is already fully paid' });
        }
        if (error.message === 'PARTIAL_AMOUNT_REQUIRED') {
            return res.status(400).json({ success: false, message: 'Partial payment amount must be greater than 0' });
        }
        if (error.message === 'AMOUNT_REQUIRED') {
            return res.status(400).json({ success: false, message: 'Payment amount must be greater than 0' });
        }
        if (error.message.startsWith('FULL_PAYMENT_MISMATCH:')) {
            const remaining = error.message.split(':')[1];
            return res.status(400).json({
                success: false,
                message: `Full payment must match remaining balance (${remaining})`
            });
        }
        if (error.message.startsWith('OVERPAYMENT')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message === 'CARD_REF_REQUIRED') {
            return res.status(400).json({
                success: false,
                message: 'Transaction reference is required for card/visa payments. Please scan or enter the POS receipt reference.'
            });
        }

        // PRISMA ERRORS
        if (error.code === 'P2002') {
            const target = String(error.meta?.target || '');
            if (target.includes('transactionRef') && idempotencyKey) {
                try {
                    const existingPayment = await req.prisma.payment.findUnique({
                        where: { transactionRef: idempotencyKey }
                    });
                    if (existingPayment) {
                        const existingPayload = await buildPaymentResponsePayload(existingPayment, req.prisma);
                        return res.json({
                            success: true,
                            message: 'Payment already processed',
                            data: existingPayload
                        });
                    }
                } catch (lookupErr) {
                    console.warn('[PAYMENTS] Failed to recover duplicate transactionRef:', lookupErr.message);
                }
            }
            return res.status(409).json({
                success: false,
                message: 'Duplicate entry detected (Receipt Number collision). Please try again.'
            });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                message: 'Invalid reference (Shift, User, or Subscription does not exist).'
            });
        }

        res.status(500).json({
            success: false,
            message: `Payment Failed: ${error.message}`,
            debug_code: error.code,
            debug_meta: error.meta
        });
    }
});

/**
 * POST /api/payments/refund
 * Refund a subscription (Calculation based on usage)
 */
router.post('/refund', requirePermission('payments.create'), [
    body('subscriptionId').isInt().withMessage('Subscription ID is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

        const { subscriptionId, reason, preview } = req.body;

        // Perform calculation logic (outside transaction for preview, or inside but throw/rollback if preview? Better to separate logic)
        // Re-using logic is key. Let's do the lookup and calc first.

        const sub = await req.prisma.subscription.findUnique({
            where: { id: parseInt(subscriptionId) },
            include: { plan: true }
        });

        if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found' });

        // 2. Fetch Total Paid (Net of any previous refunds)
        const allPayments = await req.prisma.payment.findMany({
            where: {
                subscriptionId: sub.id,
                status: { in: ['completed', 'REFUNDED'] }
            },
            select: { amount: true }
        });
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        // 3. Calculate Usage
        const now = new Date();
        const start = new Date(sub.startDate);
        let usedMs = now - start;
        if (usedMs < 0) usedMs = 0;

        // Subtract Paused Days
        let pausedMs = 0;
        if (sub.pauseHistory) {
            try {
                const history = JSON.parse(sub.pauseHistory);
                history.forEach(h => {
                    const pStart = new Date(h.start);
                    const pEnd = h.end ? new Date(h.end) : now;
                    let effectiveStart = pStart < start ? start : pStart;
                    let effectiveEnd = pEnd > now ? now : pEnd;
                    if (effectiveEnd > effectiveStart) pausedMs += (effectiveEnd - effectiveStart);
                });
            } catch (e) { console.error('Pause history parse error', e); }
        }

        const netUsedMs = Math.max(0, usedMs - pausedMs);
        const usedDays = Math.ceil(netUsedMs / (1000 * 60 * 60 * 24)); // Round up partial days

        // 4. Calculate Financials
        const planDuration = sub.plan.duration; // days
        const planPrice = sub.price || sub.plan.price;

        // Use provided dailyRate or calculate default
        let dailyRate;
        if (req.body.dailyRate !== undefined && req.body.dailyRate !== null) {
            dailyRate = parseFloat(req.body.dailyRate);
        } else {
            dailyRate = planPrice / planDuration;
        }

        const usedAmount = usedDays * dailyRate;

        let refundable = totalPaid - usedAmount;
        if (refundable < 0) refundable = 0;

        // PREVIEW MODE: Return calculation here
        if (preview) {
            return res.json({
                success: true,
                data: {
                    planName: sub.plan.name,
                    planPrice,
                    planDuration,
                    usedDays,
                    dailyRate, // keep precision
                    paidAmount: totalPaid,
                    usedAmount,
                    refundableAmount: refundable,
                    canRefund: refundable > 0
                }
            });
        }

        // EXECUTION MODE
        const result = await req.prisma.$transaction(async (prisma) => {
            // Determine final refund amount
            // If manual amount provided, use it. Otherwise use calculated refundable.
            let finalRefundAmount = refundable;
            if (req.body.amount !== undefined && req.body.amount !== null) {
                finalRefundAmount = parseFloat(req.body.amount);
            }

            if (finalRefundAmount <= 0) throw new Error('Refund amount must be greater than 0');
            if (finalRefundAmount > totalPaid) throw new Error('Cannot refund more than total paid amount');

            // 5. Create Negative Payment (Refund)
            const refundPayment = await prisma.payment.create({
                data: {
                    memberId: sub.memberId,
                    subscriptionId: sub.id,
                    amount: -1 * finalRefundAmount,
                    method: 'CASH',
                    status: 'REFUNDED',
                    receiptNumber: generateReceiptNumber() + '-REF',
                    notes: `Refund: ${finalRefundAmount.toFixed(2)} EGP. Used ${usedDays} days. Rate: ${dailyRate.toFixed(2)}. Reason: ${reason || 'N/A'}`,
                    createdBy: req.user.id,
                    collectorName: `${req.user.firstName} ${req.user.lastName}`,
                    shiftId: req.activeShift?.id
                }
            });

            // 6. Update Subscription Logic
            // Check if client explicitly requested cancellation, or default to cancel only if full refund
            const shouldCancel = req.body.cancelSubscription === true;

            const updateData = {
                paidAmount: { decrement: finalRefundAmount },
                // Recalculate remaining just in case
                remainingAmount: Math.max(0, (sub.price || sub.plan.price || 0) - (totalPaid - finalRefundAmount))
            };

            if (shouldCancel) {
                updateData.status = 'cancelled';
                updateData.canceledAt = now;
                updateData.cancelReason = reason || 'Refunded';
                updateData.remainingAmount = 0; // Clear remaining if cancelled
            } else {
                // If not cancelling, ensure it's active (or keep current status if not 'expired')
                // If it was 'paid', it might become 'partial' or 'unpaid'
                // But simplified: Just don't set to 'cancelled'.
                // Optionally update paymentStatus
                const newTotalPaid = totalPaid - finalRefundAmount;
                const totalPrice = sub.price || sub.plan.price || 0;

                let newPayStatus = 'unpaid';
                if (newTotalPaid >= totalPrice - 0.01) newPayStatus = 'paid';
                else if (newTotalPaid > 0) newPayStatus = 'partial';

                updateData.paymentStatus = newPayStatus;
            }

            await prisma.subscription.update({
                where: { id: sub.id },
                data: updateData
            });

            return { refundPayment, details: { totalPaid, usedDays, usedAmount, refundable: finalRefundAmount, status: shouldCancel ? 'cancelled' : 'active' } };
        });

        res.json({ success: true, message: 'Refund processed successfully', data: result });

    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ success: false, message: error.message || 'Refund failed' });
    }
});

/**
 * GET /api/payments/receipt/:receiptNumber
 * Search payment by receipt number (RBAC: Admin or Staff Current Shift)
 */
router.get('/receipt/:receiptNumber', requirePermission('payments.view'), async (req, res) => {
    try {
        const { receiptNumber } = req.params;

        // 1. Find Payment
        const payment = await req.prisma.payment.findUnique({
            where: { receiptNumber },
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                },
                subscription: {
                    include: { plan: true }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                shift: {
                    select: { id: true, openedAt: true, closedAt: true }
                },
                refunds: {
                    include: {
                        user: { select: { firstName: true, lastName: true } }
                    }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        // 2. RBAC Enforcement
        if (req.user.role !== 'admin') {
            // SENSITIVE: Staff can ONLY search valid receipts.
            // But for "Receipt Search", we might want to allow searching ANY receipt to check status?
            // User Requirement: "STAFF can search receipts ONLY within CURRENT SHIFT by default."
            // This implies strict filtering.
            const openShift = await req.prisma.pOSShift.findFirst({
                where: { openedBy: req.user.id, closedAt: null }
            });

            if (!openShift) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Open a shift to search receipts.'
                });
            }

            if (payment.shiftId !== openShift.id) {
                // Decide: Should staff see OLD receipts?
                // "STAFF can search receipts ONLY within CURRENT SHIFT" -> Strict.
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only view receipts from your current active shift.'
                });
            }
        } // End RBAC

        // 3. Compute Financial State
        const refundedTotal = payment.refundedTotal;

        // Calculate refundable balance considering consumed amount
        // Refundable = Total Paid - Total Refunded - Consumed (Non-Refundable)
        let remainingRefundable = payment.amount - refundedTotal;

        // If linked to subscription, subtract usedNonRefundableAmount
        if (payment.subscription && payment.subscription.usedNonRefundableAmount) {
            // For subscription-level calculation:
            // Get all payments for this subscription
            const subscriptionPayments = await req.prisma.payment.findMany({
                where: { subscriptionId: payment.subscriptionId },
                include: { refunds: true }
            });

            const totalPaidForSub = subscriptionPayments.reduce((sum, p) => sum + p.amount, 0);
            const totalRefundedForSub = subscriptionPayments.reduce((sum, p) => {
                return sum + (p.refunds?.reduce((rSum, r) => rSum + r.amount, 0) || 0);
            }, 0);

            // Subscription Refundable Balance = Total Paid - Total Refunded - Used Non-Refundable
            const subRefundableBalance = totalPaidForSub - totalRefundedForSub - payment.subscription.usedNonRefundableAmount;

            // For this specific payment, show the subscription's overall refundable balance
            remainingRefundable = Math.max(0, subRefundableBalance);
        }

        // 4. Get Visit Stats (Check-ins)
        // Subscription visits: Only check-ins during the subscription period
        const subVisitsCount = payment.subscriptionId ? await req.prisma.checkIn.count({
            where: {
                memberId: payment.memberId,
                checkInTime: {
                    gte: payment.subscription.startDate,
                    lte: payment.subscription.endDate
                }
            }
        }) : 0;

        // All-time visits
        const allTimeVisitsCount = await req.prisma.checkIn.count({
            where: { memberId: payment.memberId }
        });

        // 5. Return Enhanced Data
        res.json({
            success: true,
            data: {
                ...payment,
                refundedTotal,
                remainingRefundable: remainingRefundable < 0 ? 0 : remainingRefundable,
                stats: {
                    subVisits: subVisitsCount,
                    allTimeVisits: allTimeVisitsCount
                }
            }
        });

    } catch (error) {
        console.error('Receipt search error:', error);
        res.status(500).json({ success: false, message: 'Failed to search receipt' });
    }
});

/**
 * GET /api/payments/latest
 * Fetch the most recent receipt for a subscription or member
 */
router.get('/latest', async (req, res) => {
    try {
        const { subscriptionId, memberId } = req.query;
        const parsedSubscriptionId = subscriptionId ? parseInt(subscriptionId, 10) : null;
        const parsedMemberId = memberId ? parseInt(memberId, 10) : null;

        if (!Number.isInteger(parsedSubscriptionId) && !Number.isInteger(parsedMemberId)) {
            return res.status(400).json({
                success: false,
                message: 'subscriptionId or memberId is required'
            });
        }

        const where = {
            status: { not: 'pending' }
        };

        if (Number.isInteger(parsedSubscriptionId)) {
            where.subscriptionId = parsedSubscriptionId;
        } else if (Number.isInteger(parsedMemberId)) {
            where.memberId = parsedMemberId;
        }

        const payment = await req.prisma.payment.findFirst({
            where,
            orderBy: { paidAt: 'desc' },
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                },
                subscription: {
                    include: { plan: true }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                refunds: {
                    include: {
                        user: { select: { firstName: true, lastName: true } }
                    }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Receipt not found' });
        }

        res.json({ success: true, data: payment });
    } catch (error) {
        console.error('Get latest receipt error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch latest receipt' });
    }
});

/**
 * GET /api/payments/:id
 * Get single payment details
 */
router.get('/:id', async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        const payment = await req.prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                },
                subscription: {
                    include: { plan: true }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                refunds: {
                    include: {
                        user: { select: { firstName: true, lastName: true } }
                    }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Calculate refundable balance
        const refundedTotal = payment.refundedTotal || 0;
        let remainingRefundable = payment.amount - refundedTotal;

        // If linked to subscription, subtract usedNonRefundableAmount
        if (payment.subscription && payment.subscription.usedNonRefundableAmount > 0) {
            // Subscription Refundable Balance = Total Paid - Total Refunded - Used Non-Refundable

            // Get all payments for this subscription to handle aggregate states
            const subscriptionPayments = await req.prisma.payment.findMany({
                where: { subscriptionId: payment.subscriptionId },
                include: { refunds: true }
            });

            const totalPaidForSub = subscriptionPayments
                .filter(p => p.status === 'completed' || p.status === 'Partial Refund' || p.status === 'refunded')
                .reduce((sum, p) => sum + p.amount, 0);

            const totalRefundedForSub = subscriptionPayments.reduce((sum, p) => {
                return sum + (p.refunds?.reduce((rSum, r) => rSum + r.amount, 0) || 0);
            }, 0);

            const subRefundableBalance = totalPaidForSub - totalRefundedForSub - payment.subscription.usedNonRefundableAmount;

            // For this specific payment, we cap at the payment's own remaining amount, but stricter rule is the subscription limit
            remainingRefundable = Math.min(remainingRefundable, Math.max(0, subRefundableBalance));
        }

        res.json({
            success: true,
            data: {
                ...payment,
                remainingRefundable: Math.max(0, remainingRefundable)
            }
        });
    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payment' });
    }
});

/**
 * GET /api/payments/:id/receipt
 * Generate PDF receipt
 */
router.get('/:id/receipt', async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);

        const payment = await req.prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                member: true,
                subscription: {
                    include: { plan: true }
                },
                refunds: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        // Get gym settings
        const settings = await req.prisma.setting.findMany({
            where: {
                key: {
                    in: ['gym_name', 'gym_phone', 'gym_email', 'gym_address', 'currency_symbol']
                }
            }
        });

        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);

        // Create PDF
        const doc = new PDFDocument({ size: 'A5', margin: 30 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt-${payment.receiptNumber}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).text(settingsMap.gym_name || 'Gym Management System', { align: 'center' });
        doc.fontSize(10).text(settingsMap.gym_address || '', { align: 'center' });
        doc.text(`Phone: ${settingsMap.gym_phone || ''} | Email: ${settingsMap.gym_email || ''}`, { align: 'center' });

        doc.moveDown(2);

        // Receipt title
        doc.fontSize(16).text('PAYMENT RECEIPT', { align: 'center' });
        doc.moveDown();

        // Receipt details
        doc.fontSize(10);
        doc.text(`Receipt No: ${payment.receiptNumber}`);
        doc.text(`Date: ${new Date(payment.paidAt).toLocaleDateString()}`);

        doc.moveDown();

        // Member details
        doc.text(`Member: ${payment.member.firstName} ${payment.member.lastName}`);
        doc.text(`Member ID: ${payment.member.memberId}`);

        doc.moveDown();

        // Payment details
        if (payment.subscription) {
            doc.text(`Plan: ${payment.subscription.plan.name}`);
            doc.text(`Period: ${new Date(payment.subscription.startDate).toLocaleDateString()} - ${new Date(payment.subscription.endDate).toLocaleDateString()}`);
        }

        doc.moveDown();

        // Watermark if Fully Refunded
        const totalRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
        const netPaid = payment.amount - totalRefunded;
        const isFullyRefunded = netPaid <= 0.01; // Float tolerance

        if (isFullyRefunded) {
            doc.save();
            doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] });
            doc.fontSize(60).fillColor('red').opacity(0.15)
                .text('REFUNDED', 0, doc.page.height / 2 - 30, { align: 'center', width: doc.page.width });
            doc.restore();
            doc.fillColor('black').opacity(1); // Reset
        }

        doc.moveDown();

        // Financial Summary Table
        const symbol = settingsMap.currency_symbol || '$';
        const startX = 50; // Left margin approx
        const endX = doc.page.width - 50;
        let currentY = doc.y;

        // Helper for rows
        const drawRow = (label, value, isBold = false, color = 'black', date = null) => {
            doc.fillColor(color).fontSize(isBold ? 11 : 10).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
            doc.text(label, startX, currentY);
            if (date) {
                doc.fontSize(8).fillColor('gray').text(`(${date})`, startX + 100, currentY + 2); // Indented date
                doc.fillColor(color).fontSize(isBold ? 11 : 10); // Reset
            }
            doc.text(`${symbol}${parseFloat(value).toFixed(2)}`, startX, currentY, { align: 'right', width: endX - startX });
            currentY += 20;
        };

        // 1. Original Amount
        drawRow('Membership Fees', payment.amount);

        // 2. Refunds
        if (payment.refunds.length > 0) {
            payment.refunds.forEach(refund => {
                const dateStr = new Date(refund.createdAt).toLocaleDateString();
                drawRow('Refund Processed', -refund.amount, false, 'red', dateStr);
            });
        }

        // 3. Divider
        doc.moveTo(startX, currentY).lineTo(endX, currentY).strokeColor('gray').dash(2, { space: 2 }).stroke();
        currentY += 10;
        doc.undash(); // Reset dash

        // 4. Net Paid
        drawRow('NET PAID', netPaid < 0 ? 0 : netPaid, true, 'black');

        // Payment Method
        doc.moveDown(1);
        doc.fontSize(10).font('Helvetica').fillColor('gray')
            .text(`Payment Method: ${payment.method.toUpperCase()}`, { align: 'right' });

        doc.moveDown(2);

        // Footer
        doc.fontSize(8).text('Thank you for your business!', { align: 'center' });
        doc.text('This is a computer-generated receipt.', { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('Generate receipt error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate receipt'
        });
    }
});

/**
 * POST /api/payments/:id/refund
 * Process a refund (Partial or Full)
 */
router.post('/:id/refund', requirePermission('payments.refund'), async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        const { amount, reason } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Valid refund amount is required' });
        }

        const refundAmount = parseFloat(amount);

        // 1. Get Payment & Previous Refunds
        const payment = await req.prisma.payment.findUnique({
            where: { id: paymentId },
            include: { refunds: true }
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // 2. Calculate remaining balance
        const totalRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
        const remainingBalance = payment.amount - totalRefunded;

        // 3. Strict Refund Policy: Check Subscription Usage
        // If this payment is linked to a subscription, we must respect the "Non-Refundable Used Amount"
        // Refundable Balance = Paid(Total) - Refunded(Total) - Used(NonRefundable)

        if (payment.subscriptionId) {
            const sub = await req.prisma.subscription.findUnique({
                where: { id: payment.subscriptionId },
                include: { payments: true }
            });

            if (sub && sub.usedNonRefundableAmount > 0) {
                // Calculate TOTAL paid for this subscription
                const totalPaidForSub = sub.payments
                    .filter(p => p.status === 'completed' || p.status === 'Partial Refund' || p.status === 'refunded')
                    .reduce((sum, p) => sum + p.amount, 0);

                // Calculate TOTAL refunded for this subscription
                const totalRefundedForSub = await req.prisma.refund.aggregate({
                    where: { payment: { subscriptionId: sub.id } },
                    _sum: { amount: true }
                });
                const totalRefundedVal = totalRefundedForSub._sum.amount || 0;

                // Real Refundable Balance
                // Note: we check the AGGREGATE state, not just this payment, although usually 1:1.
                const subRefundableBalance = totalPaidForSub - totalRefundedVal - sub.usedNonRefundableAmount;

                // If the requested amount implies we are refunding "used" money
                // (i.e., if Current_Refund > Available_Refundable_Balance)
                if (refundAmount > subRefundableBalance + 0.001) { // float tolerance
                    // REJECT unless Goodwill Permission
                    const isGoodwill = req.body.goodwill === true;

                    if (!isGoodwill) {
                        return res.status(400).json({
                            success: false,
                            message: `Cannot refund: consumed amount is non-refundable. Max refundable: ${subRefundableBalance.toFixed(2)}`,
                            code: 'NON_REFUNDABLE_USAGE',
                            maxRefundable: subRefundableBalance
                        });
                    }

                    // Check Permission
                    if (req.user.role !== 'admin' && (!req.user.permissions || !req.user.permissions.includes('payments.refund.goodwill'))) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: "Refund Non-Refundable Amount" permission required for Goodwill refund.'
                        });
                    }

                    if (!reason || reason.length < 5) {
                        return res.status(400).json({
                            success: false,
                            message: 'Goodwill refunds require a valid reason (min 5 chars).'
                        });
                    }
                }
            }
        }

        if (refundAmount > remainingBalance + 0.001) {
            return res.status(400).json({
                success: false,
                message: `Refund amount (${refundAmount}) exceeds remaining balance (${remainingBalance})`
            });
        }

        // 3. STRICT SHIFT CHECK
        let shiftId;
        shiftId = req.activeShift?.id;

        if (!shiftId) {
            const userShift = await req.prisma.pOSShift.findFirst({
                where: {
                    openedBy: req.user.id,
                    closedAt: null
                }
            });
            if (!userShift) {
                return res.status(403).json({
                    success: false,
                    message: 'Action denied. Please open your shift first.'
                });
            }
            shiftId = userShift.id;
        }

        // 4. Create Refund Record (Transactional)
        const result = await req.prisma.$transaction(async (prisma) => {
            const refund = await prisma.refund.create({
                data: {
                    paymentId: payment.id,
                    amount: refundAmount,
                    reason: reason || (req.body.goodwill ? 'Goodwill Refund' : 'Refund'),
                    shiftId: shiftId,
                    createdBy: req.user.id
                }
            });

            // 5. Update Payment Status & Total Refunded
            const newTotalRefunded = (payment.refundedTotal || 0) + refundAmount;
            let newStatus = payment.status;

            if (newTotalRefunded >= payment.amount - 0.01) {
                newStatus = 'refunded';
            } else {
                newStatus = 'Partial Refund';
            }

            await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    status: newStatus,
                    refundedTotal: { increment: refundAmount }
                }
            });

            // 6. Check Subscription Termination (Full Refund Rule)
            if (payment.subscriptionId) {
                // Aggregate totals for the subscription to check if fully refunded
                const subStats = await prisma.payment.aggregate({
                    where: {
                        subscriptionId: payment.subscriptionId,
                        status: { in: ['completed', 'refunded', 'Partial Refund'] }
                    },
                    _sum: {
                        amount: true,
                        refundedTotal: true
                    }
                });

                const totalPaid = Number(subStats._sum.amount || 0);
                const totalRefunded = Number(subStats._sum.refundedTotal || 0);

                // If fully refunded (within small tolerance), terminate subscription
                if (totalPaid > 0 && totalRefunded >= totalPaid - 0.01) {
                    // Fetch to append note safely
                    const currentSub = await prisma.subscription.findUnique({
                        where: { id: payment.subscriptionId },
                        select: { notes: true, status: true }
                    });

                    if (currentSub && currentSub.status !== 'cancelled' && currentSub.status !== 'ended') {
                        const autoNote = ' [Auto-cancelled via Full Refund]';
                        const newNotes = (currentSub.notes || '') + autoNote;

                        await prisma.subscription.update({
                            where: { id: payment.subscriptionId },
                            data: {
                                status: 'ended',
                                endDate: new Date(),
                                notes: (currentSub.notes || '') + `\n[System] Auto-cancelled due to full refund on ${new Date().toLocaleDateString()}`,
                                canceledAt: new Date(),
                                canceledById: req.user.id,
                                cancelReason: 'Auto-cancelled due to full refund',
                                cancelSource: 'auto_refund',
                                remainingDays: 0
                            }
                        });
                    }
                }
            }

            return refund;
        });

        // 6. Log Activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'REFUND_PAYMENT',
                entityType: 'Payment',
                entityId: payment.id,
                details: JSON.stringify({
                    amount: refundAmount,
                    reason,
                    shiftId,
                    goodwill: req.body.goodwill || false
                })
            }
        });

        res.json({
            success: true,
            message: 'Refund processed successfully',
            data: result
        });

    } catch (error) {
        console.error('Refund payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund'
        });
    }
});

/**
 * GET /api/payments/summary
 * Get payment summary
 */
router.get('/summary/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const where = { status: 'completed' };
        if (startDate || endDate) {
            where.paidAt = {};
            if (startDate) where.paidAt.gte = new Date(startDate);
            if (endDate) where.paidAt.lte = new Date(endDate);
        }

        // RBAC: Staff can ONLY see stats for their current open shift
        if (req.user.role !== 'admin') {
            const openShift = await req.prisma.pOSShift.findFirst({
                where: {
                    openedBy: req.user.id,
                    closedAt: null
                }
            });

            if (!openShift) {
                // No open shift = No stats
                return res.json({
                    success: true,
                    data: {
                        totalRevenue: 0,
                        paymentCount: 0,
                        averagePayment: 0,
                        byMethod: {}
                    }
                });
            }

            where.shiftId = openShift.id;
        }

        const payments = await req.prisma.payment.findMany({ where });

        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const byMethod = payments.reduce((acc, p) => {
            acc[p.method] = (acc[p.method] || 0) + p.amount;
            return acc;
        }, {});

        res.json({
            success: true,
            data: {
                totalRevenue,
                paymentCount: payments.length,
                averagePayment: payments.length > 0 ? totalRevenue / payments.length : 0,
                byMethod
            }
        });

    } catch (error) {
        console.error('Get payment summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment summary'
        });
    }
});

/**
 * GET /api/payments/summary/financials
 * Detailed financial breakdown by method (Paid, Refunded, Net)
 * Params: scope (currentShift | all)
 */
router.get('/summary/financials', requirePermission('payments.view'), async (req, res) => {
    try {
        const { scope = 'currentShift' } = req.query;
        let where = { status: { not: 'cancelled' } }; // Exclude fully cancelled if you have that status, otherwise 'completed' and 'refunded' are fine. 
        // Note: 'refunded' status usually means fully refunded, 'completed' means paid (and maybe partially refunded).
        // Safest is to just include all valid payments and sum their amounts and refunds.

        // 1. Determine Scope
        if (req.user.role !== 'admin') {
            // Staff: FORCED to current shift
            const openShift = await req.prisma.pOSShift.findFirst({
                where: { openedBy: req.user.id, closedAt: null }
            });

            if (!openShift) {
                // No open shift -> Return Zeros
                return res.json({
                    success: true,
                    data: {
                        cash: { paid: 0, refunded: 0, net: 0 },
                        card: { paid: 0, refunded: 0, net: 0 },
                        transfer: { paid: 0, refunded: 0, net: 0 },
                        total: { paid: 0, refunded: 0, net: 0 }
                    }
                });
            }
            where.shiftId = openShift.id;
        } else {
            // Admin: Check scope param
            if (scope === 'currentShift') {
                // Admin's "Current Shift" context: Usually means "Currently Open Shifts" globally or "My Open Shift"?
                // USER REQUEST: "Staff: default scope = CURRENT OPEN SHIFT... Admin: toggle Current Shift | All Shifts"
                // "If All Shifts is selected, totals are calculated across all shifts."
                // "If Current Shift ... " -> For Admin, this is ambiguous. Usually means "Today's active shifts" or "My active shift".
                // Given the context of "Shift Scoping", let's interpret "Current Shift" for Admin as "ANY currently open shift" OR "The specific shift context if they had one". 
                // But strictly adhering to "Staff sees only what they have permission for", and Admin having global.
                // Let's assume Admin "Current Shift" means GLOBAL OPEN SHIFTS (all active business right now).

                // Wait, typically "Current Shift" in this app context implies the user's shift. 
                // If Admin has no shift open, maybe show 0? 
                // Or maybe "Current Shift" for Admin means "Active Shifts currently running in the gym".
                // Let's look at `payments.js` generic route. It doesn't use scoped logic for Admin.
                // Re-reading request: "If no shift is open: Staff should see 0... Admin can still use All Shifts".
                // This implies Admin might see 0 for "Current Shift" if they don't have one? 
                // Let's stick to: "Current Shift" = Req.user's open shift. If admin wants everything, they use "All Shifts".

                const openShift = await req.prisma.pOSShift.findFirst({
                    where: { openedBy: req.user.id, closedAt: null }
                });

                if (openShift) {
                    where.shiftId = openShift.id;
                } else {
                    // If Admin selects "Current Shift" but has none, return 0s (Matches "If no shift is open")
                    return res.json({
                        success: true,
                        data: {
                            cash: { paid: 0, refunded: 0, net: 0 },
                            card: { paid: 0, refunded: 0, net: 0 },
                            transfer: { paid: 0, refunded: 0, net: 0 },
                            total: { paid: 0, refunded: 0, net: 0 }
                        }
                    });
                }
            }
            // If scope === 'all', remove shiftId filter (already open logic)
        }

        // 2. Fetch Data
        const payments = await req.prisma.payment.findMany({
            where: where,
            include: { refunds: true }
        });

        // 3. Aggregate
        const stats = {
            cash: { paid: 0, refunded: 0, net: 0 },
            card: { paid: 0, refunded: 0, net: 0 },
            transfer: { paid: 0, refunded: 0, net: 0 },
            total: { paid: 0, refunded: 0, net: 0 }
        };

        payments.forEach(p => {
            const method = p.method || 'cash'; // Fallback
            const paid = p.amount || 0;

            // Sum refunds for this payment
            // Note: Refunds might be in a DIFFERENT shift? 
            // REQUEST: "Refunded Y = sum of refunded amounts for that method WITHIN THE SELECTED SCOPE"
            // Crucial: If I paid $100 yesterday (Shift A), and refund $20 today (Shift B).
            // If I look at Shift B stats: Paid should be 0 (payment not in shift). Refunded should be 20. Net -20.
            // If I look at Shift A stats: Paid 100. Refunded 0 (refund not in shift). Net 100.

            // CURRENT LOGIC: `include: { refunds: true }` fetches ALL refunds for that payment, regardless of shift.
            // THIS IS WRONG for Shift Scoping. 
            // We must only count refunds that belong to the scope!

            // Correction: We need to query Refunds directly? Or filter the included refunds?

            // Approach A: Aggregate Payments (for Paid) and Refunds (for Refunded) SEPARATELY.
            // Because a Refund record has a `shiftId`.
        });

        // RE-DESIGN AGGREGATION

        // 1. Calculate PAID (From Payments in scope)
        const paymentsInScope = await req.prisma.payment.findMany({
            where: { ...where }, // Copy where clause
        });

        paymentsInScope.forEach(p => {
            const method = (p.method || 'cash').toLowerCase();
            if (stats[method]) {
                stats[method].paid += p.amount;
                stats.total.paid += p.amount;
            }
        });

        // 2. Calculate REFUNDED (From Refunds in scope)
        // We need a where clause for Refunds.
        // If scope has shiftId -> refund.shiftId = X
        // If scope is all -> no shift filter.

        const refundWhere = {};
        if (where.shiftId) {
            refundWhere.shiftId = where.shiftId;
        }

        const refundsInScope = await req.prisma.refund.findMany({
            where: refundWhere,
            include: { payment: true } // Need payment to know the METHOD
        });

        refundsInScope.forEach(r => {
            const method = (r.payment?.method || 'cash').toLowerCase();
            if (stats[method]) {
                stats[method].refunded += r.amount;
                stats.total.refunded += r.amount;
            }
        });

        // 3. Calculate Nets
        ['cash', 'card', 'transfer', 'total'].forEach(key => {
            stats[key].net = stats[key].paid - stats[key].refunded;
        });

        res.json({ success: true, data: stats });

    } catch (error) {
        console.error('Financial summary error:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate financials' });
    }
});


/**
 * GET /api/payments/summary/breakdown
 * Unified Financial Breakdown (Paid, Refunded, Net) by Method
 * Logic: Cash Drawer (Money In vs Money Out during scope)
 */
router.get('/summary/breakdown', requirePermission('payments.view'), async (req, res) => {
    try {
        const { scope = 'currentShift', startDate, endDate } = req.query;
        // console.log(`[BREAKDOWN] Scope: ${scope}, Date: ${startDate}-${endDate}, User: ${req.user.role}`);

        // 1. Determine Scope Constraints
        const paymentWhere = { status: { not: 'cancelled' } }; // Money In
        const refundWhere = {}; // Money Out

        if (req.user.role !== 'admin') {
            // Staff: Strict Current Shift
            const openShift = await req.prisma.pOSShift.findFirst({
                where: { openedBy: req.user.id, closedAt: null }
            });

            if (!openShift) {
                // Zero state
                return res.json({
                    success: true,
                    data: {
                        cash: { paid: 0, refunded: 0, net: 0 },
                        card: { paid: 0, refunded: 0, net: 0 },
                        transfer: { paid: 0, refunded: 0, net: 0 },
                        total: { paid: 0, refunded: 0, net: 0 }
                    }
                });
            }
            paymentWhere.shiftId = openShift.id;
            refundWhere.shiftId = openShift.id;
        } else {
            // Admin: Check Scope
            if (scope === 'currentShift') {
                // Admin "Current Shift" = Global Active Shifts
                // We find ALL currently open shifts
                const activeShifts = await req.prisma.pOSShift.findMany({
                    where: { closedAt: null },
                    select: { id: true }
                });
                const activeShiftIds = activeShifts.map(s => s.id);

                if (activeShiftIds.length > 0) {
                    paymentWhere.shiftId = { in: activeShiftIds };
                    refundWhere.shiftId = { in: activeShiftIds };
                } else {
                    // No active shifts in gym -> 0
                    paymentWhere.shiftId = -1; // Hack to return 0 matches
                    refundWhere.shiftId = -1;
                }
            } else {
                // All Shifts / Date Range
                if (startDate || endDate) {
                    paymentWhere.createdAt = {};
                    refundWhere.createdAt = {}; // Refunds happened in this range
                    // Important: For refunds, we care when the REFUND happened, not the payment.
                    if (startDate) {
                        paymentWhere.createdAt.gte = new Date(startDate);
                        refundWhere.createdAt.gte = new Date(startDate);
                    }
                    if (endDate) {
                        paymentWhere.createdAt.lte = new Date(endDate);
                        refundWhere.createdAt.lte = new Date(endDate);
                    }
                }
            }
        }

        // 2. Aggregate PAYMENTS (Money In)
        const payments = await req.prisma.payment.groupBy({
            by: ['method'],
            where: paymentWhere,
            _sum: { amount: true }
        });

        // 3. Aggregate REFUNDS (Money Out)
        // Need to group refunds by PAYMENT METHOD. 
        // Prisma can't groupBy relational field directly.
        // We fetch refunds and summing manually is safest/easiest given volume.
        const refunds = await req.prisma.refund.findMany({
            where: refundWhere,
            include: {
                payment: { select: { method: true } }
            }
        });

        // 4. Build Result
        // Init
        const result = {
            cash: { paid: 0, refunded: 0, net: 0 },
            card: { paid: 0, refunded: 0, net: 0 },
            transfer: { paid: 0, refunded: 0, net: 0 },
            total: { paid: 0, refunded: 0, net: 0 }
        };

        // Fill Paid
        payments.forEach(p => {
            const m = p.method?.toLowerCase() || 'cash';
            if (result[m]) {
                result[m].paid = p._sum.amount || 0;
            }
        });

        // Fill Refunded
        refunds.forEach(r => {
            const m = r.payment?.method?.toLowerCase() || 'cash';
            if (result[m]) {
                result[m].refunded += (r.amount || 0);
            }
        });

        // Calculate Net & Totals
        ['cash', 'card', 'transfer'].forEach(method => {
            result[method].net = result[method].paid - result[method].refunded;

            result.total.paid += result[method].paid;
            result.total.refunded += result[method].refunded;
            result.total.net += result[method].net;
        });

        res.json({ success: true, data: result });

    } catch (error) {
        console.error('Breakdown stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch financial breakdown' });
    }
});


/**
 * POST /api/payments/:id/refund
 * Process a refund (partial or full)
 */
router.post('/:id/refund', requireActiveShift, async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        const { amount, reason, goodwill } = req.body; // goodwill: boolean

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid refund amount' });
        }

        const result = await req.prisma.$transaction(async (prisma) => {
            // 1. Fetch Payment & Subscription
            const payment = await prisma.payment.findUnique({
                where: { id: paymentId },
                include: { subscription: true, refunds: true }
            });

            if (!payment) throw new Error('Payment not found');

            // 2. Strict Refundable Calculation
            const refundedTotal = payment.refundedTotal || 0;
            const consumed = (payment.subscription?.usedNonRefundableAmount || 0);

            // Logic:
            // "Paid Total" - "Already Refunded" - "Consumed" = "Available for Refund"
            // Example: 500 Paid - 0 Refunded - 20 Consumed = 480 Refundable.
            // If User tries to refund 481, REJECT.
            // If User tries to refund 20 (and 480 was already refunded), REJECT.

            // NOTE: We must check if this specific payment covers the subscription cost.
            // Ideally, we look at the Subscription's aggregate state, but here we scope to the Payment.
            // To be safe & simple: The "Refundable Balance" of this payment is reduced by the consumed amount
            // if it is linked to the subscription.

            let maxRefundable = payment.amount - refundedTotal;

            if (payment.subscriptionId) {
                // If it's a subscription payment, we must respect the consumed amount.
                // We subtract the consumed amount from the *theoretical* max of this payment?
                // Or better: The Subscription has a global `usedNonRefundableAmount`.
                // We shouldn't double-count if there are multiple payments.
                // But typically 1 sub has 1 or 2 payments.
                // STRATEGY: 
                // 1. Get total paid for sub.
                // 2. Get total refunded for sub.
                // 3. Get consumed.
                // 4. Global Refundable = TotalPaid - TotalRefunded - Consumed.
                // 5. This Payment's specific refundable cap is min(PaymentRemaining, GlobalRefundable).

                const subPayments = await prisma.payment.findMany({
                    where: { subscriptionId: payment.subscriptionId }
                });

                const subTotalPaid = subPayments.reduce((acc, p) => acc + p.amount, 0);
                const subTotalRefunded = subPayments.reduce((acc, p) => acc + (p.refundedTotal || 0), 0);

                const globalRefundable = subTotalPaid - subTotalRefunded - consumed;

                // The absolute limit for THIS payment is also its own remaining amount
                const paymentRemaining = payment.amount - refundedTotal;

                maxRefundable = Math.min(paymentRemaining, Math.max(0, globalRefundable));
            }

            // 3. Validate Amount
            if (amount > maxRefundable + 0.01) { // 0.01 float tolerance
                // CHECK GOODWILL
                if (goodwill) {
                    // Check Permission
                    // We need to check if user has 'refund_non_refundable' permission
                    // We can't use middleware easily inside transaction, so manual check:
                    const user = await prisma.user.findUnique({
                        where: { id: req.user.id },
                        include: { role: true } // Assuming permissions stored here or unrelated
                    });

                    // Assuming permissions are in req.user from auth middleware
                    const userPerms = req.user.permissions || [];
                    if (req.user.role !== 'admin' && !userPerms.includes('refund_non_refundable')) {
                        throw new Error('GOODWILL_DENIED');
                    }

                    // If allowed, we proceed. Be careful: `maxRefundable` was the strict limit.
                    // The "Safe" limit is just `payment.amount - refundedTotal` (can't refund money we never took).
                    const absoluteLimit = payment.amount - refundedTotal;
                    if (amount > absoluteLimit) {
                        throw new Error('EXCEEDS_PAYMENT_TOTAL');
                    }

                } else {
                    // Strict Rejection
                    throw new Error('NON_REFUNDABLE_USAGE');
                }
            }

            // 4. Create Refund
            const refund = await prisma.refund.create({
                data: {
                    paymentId,
                    amount: parseFloat(amount),
                    reason: goodwill ? `[GOODWILL] ${reason}` : reason,
                    shiftId: req.activeShift.id,
                    createdBy: req.user.id
                }
            });

            // 5. Update Payment
            await prisma.payment.update({
                where: { id: paymentId },
                data: { refundedTotal: { increment: parseFloat(amount) } }
            });

            // 6. Log
            await prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'REFUND_PAYMENT',
                    entityType: 'Payment',
                    entityId: paymentId,
                    details: JSON.stringify({ amount, reason, goodwill })
                }
            });

            return refund;
        });

        res.json({
            success: true,
            message: 'Refund processed successfully',
            data: result
        });

    } catch (error) {
        console.error('Refund error:', error);

        if (error.message === 'NON_REFUNDABLE_USAGE') {
            return res.status(409).json({
                success: false,
                code: 'NON_REFUNDABLE_USAGE',
                message: 'لا يمكن استرداد هذا المبلغ لأنه تم استخدامه كمستحق للمكان (غير قابل للاسترداد).'
            });
        }

        if (error.message === 'GOODWILL_DENIED') {
            return res.status(403).json({
                success: false,
                message: 'عفواً، ليس لديك صلاحية استرداد المبالغ غير المستردة (Goodwill).'
            });
        }

        if (error.message === 'EXCEEDS_PAYMENT_TOTAL') {
            return res.status(400).json({
                success: false,
                message: 'Refund amount cannot exceed original payment amount.'
            });
        }

        res.status(500).json({ success: false, message: 'Failed to process refund' });
    }
});

module.exports = router;
