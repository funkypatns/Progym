/**
 * ============================================
 * REPORTS ROUTES
 * ============================================
 * 
 * Backend API endpoints for financial reports
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { calculateSubscriptionFinancials,
    determinePaymentStatus,
    getOutstandingSubscriptions,
    calculateNetRevenue
} = require('../utils/financialCalculations');
const { parseDateRange } = require('../utils/dateParams');
const XLSX = require('xlsx');

const sendExcelResponse = (res, data, filename) => {
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        return res.send(buffer);
    } catch (error) {
        console.error('Excel generation error:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate Excel file' });
    }
};

const flattenRow = (row) => {
    const flat = {};
    const process = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}_${key}` : key;
            if (value && typeof value === 'object' && !(value instanceof Date)) {
                process(value, newKey);
            } else {
                flat[newKey] = value === null || value === undefined ? '' : value;
            }
        }
    };
    process(row);
    return flat;
};


router.use(authenticate);
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('ETag', '');
    next();
});


/**
 * GET /api/reports/revenue
 * Net revenue report (Gross - Refunds)
 */
router.get('/revenue', async (req, res) => {
    try {
        const { from, to, startDate: startDateParam, endDate: endDateParam, collectorId } = req.query;
        // Parse dates
        const { startDate, endDate, error } = parseDateRange(from || startDateParam, to || endDateParam);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        // If filtering by collector (employee), we need to manually aggregate
        if (collectorId) {
            const payments = await req.prisma.payment.findMany({
                where: {
                    paidAt: { gte: startDate, lte: endDate },
                    status: { in: ['completed', 'refunded', 'Partial Refund'] },
                    createdBy: parseInt(collectorId)
                },
                select: { amount: true, refundedTotal: true } // refundedTotal might be partial
            });

            // For revenue report by employee, we usually track what they COLLECTED vs REFUNDED?
            // Or just what they collected.
            // Let's standardise: Revenue = Collected. Refunds are separate? 
            // calculateNetRevenue handles global refunds.
            // If collectorId is present, we return their stats.

            const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            return res.json({
                success: true,
                data: {
                    summary: {
                        totalPaid: totalCollected,
                        totalRefunded: 0, // Refunds are usually done by admin, not original collector? Hard to track "refunded BY X" vs "refunded FROM X's payment".
                        netRevenue: totalCollected
                    },
                    rows: [] // simplified for now or add payment rows
                }
            });
        }

        // Global Revenue
        const stats = await calculateNetRevenue(req.prisma, startDate, endDate);

        if (req.query.format === 'excel') {
            return sendExcelResponse(res, [stats].map(s => ({
                Gross_Revenue: s.grossRevenue,
                Total_Refunds: s.totalRefunds,
                Net_Revenue: s.netRevenue,
                Payment_Count: s.paymentCount,
                Refund_Count: s.refundCount
            })), 'revenue-report.xlsx');
        }

        res.json({
            success: true,
            data: {
                summary: {
                    totalPaid: stats.grossRevenue,
                    totalRefunded: stats.totalRefunds,
                    netRevenue: stats.netRevenue,
                    paymentCount: stats.paymentCount,
                    refundCount: stats.refundCount
                },
                rows: [] // Add breakdown rows if needed later
            }
        });

    } catch (error) {
        console.error('[REPORTS] Revenue error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate revenue report' });
    }
});

/**
 * GET /api/reports/paymentRemaining
 * Alias for /payment-remaining to fix frontend mismatch
 */
router.get('/paymentRemaining', async (req, res) => {
    // Reuse the logic from /payment-remaining
    await handlePaymentRemaining(req, res);
});

// Extract handler to function to reuse
const handlePaymentRemaining = async (req, res) => {
    try {
        const { from, to, search, planId, status, employeeId, remainingOnly } = req.query;

        // Build where clause
        const where = {
            status: { in: ['active', 'expired'] }
        };

        if (from && to) {
            const { startDate, endDate, error } = parseDateRange(from, to);
            if (error) {
                return res.status(400).json({ success: false, message: error });
            }
            where.startDate = { gte: startDate, lte: endDate };
        }

        if (planId) {
            where.planId = parseInt(planId);
        }

        // Fetch subscriptions with all related data
        const subscriptions = await req.prisma.subscription.findMany({
            where,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        gender: true
                    }
                },
                plan: {
                    select: {
                        id: true,
                        name: true,
                        price: true
                    }
                },
                payments: {
                    where: {
                        status: { in: ['completed', 'refunded', 'Partial Refund'] }
                    },
                    select: {
                        id: true,
                        amount: true,
                        refundedTotal: true,
                        paidAt: true,
                        creator: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    },
                    orderBy: {
                        paidAt: 'desc'
                    }
                }
            }
        });

        // Calculate financials for each subscription
        let rows = subscriptions.map(sub => {
            const financials = calculateSubscriptionFinancials(sub, sub.payments);
            const paymentStatus = determinePaymentStatus(financials.remaining, financials.netPaid);

            const lastPayment = sub.payments.length > 0 ? sub.payments[0] : null;

            return {
                subscription: {
                    id: sub.id,
                    startDate: sub.startDate,
                    endDate: sub.endDate
                },
                member: {
                    id: sub.member.id,
                    memberId: sub.member.memberId,
                    name: `${sub.member.firstName} ${sub.member.lastName}`,
                    phone: sub.member.phone,
                    gender: sub.member.gender || 'unknown'
                },
                plan: {
                    id: sub.plan.id,
                    name: sub.plan.name
                },
                financial: {
                    total: financials.subscriptionPrice,
                    totalPaid: financials.totalPaid,
                    totalRefunded: financials.totalRefunded,
                    netPaid: financials.netPaid,
                    remaining: financials.remaining,
                    status: paymentStatus.toLowerCase()
                },
                timeline: {
                    lastPaymentDate: lastPayment?.paidAt || null
                },
                audit: {
                    collectorName: lastPayment?.creator ?
                        `${lastPayment.creator.firstName} ${lastPayment.creator.lastName}` :
                        null
                }
            };
        });

        // Apply filters
        if (search) {
            const searchLower = search.toLowerCase();
            rows = rows.filter(r =>
                r.member.name.toLowerCase().includes(searchLower) ||
                r.member.memberId.toLowerCase().includes(searchLower) ||
                r.member.phone.includes(search)
            );
        }

        if (status) {
            const statusFilter = status.split(',');
            rows = rows.filter(r => statusFilter.includes(r.financial.status));
        }

        if (remainingOnly === 'true') {
            rows = rows.filter(r => r.financial.remaining > 0);
        }

        // Calculate summary
        const summary = {
            totalDue: rows.reduce((sum, r) => sum + r.financial.total, 0),
            totalPaid: rows.reduce((sum, r) => sum + r.financial.totalPaid, 0),
            totalRefunded: rows.reduce((sum, r) => sum + r.financial.totalRefunded, 0),
            totalNetPaid: rows.reduce((sum, r) => sum + r.financial.netPaid, 0),
            totalRemaining: rows.reduce((sum, r) => sum + r.financial.remaining, 0),
            countUnpaid: rows.filter(r => r.financial.status === 'unpaid').length,
            countPartial: rows.filter(r => r.financial.status === 'partial').length,
            countSettled: rows.filter(r => r.financial.status === 'paid').length,
            countRefunded: rows.filter(r => r.financial.status === 'refunded').length
        };

        if (req.query.format === 'excel') {
            const excelRows = rows.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'payment-remaining-report.xlsx');
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json({
            success: true,
            data: {
                rows,
                summary
            }
        });

    } catch (error) {
        console.error('[REPORTS] Payment remaining error:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            code: 'REPORT_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * GET /api/reports/payment-remaining
 * Outstanding balances report with correct financial calculations
 */
router.get('/payment-remaining', async (req, res) => {
    await handlePaymentRemaining(req, res);
});

/**
 * GET /api/reports/settled-payments
 * Payments that reduced an outstanding balance (full or partial)
 */
router.get('/settled-payments', async (req, res) => {
    try {
        const { from, to, staffId, q, method, type } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: 'Date range is required'
            });
        }

        const { startDate, endDate, error } = parseDateRange(from, to);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const allowedMethods = ['cash', 'card', 'transfer', 'other'];
        const normalizedMethod = method ? String(method).toLowerCase() : null;
        if (normalizedMethod && normalizedMethod !== 'all' && !allowedMethods.includes(normalizedMethod)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        const normalizedType = type ? String(type).toLowerCase() : null;
        if (normalizedType && normalizedType !== 'all' && normalizedType !== 'full' && normalizedType !== 'partial') {
            return res.status(400).json({ success: false, message: 'Invalid settlement type' });
        }

        const paymentWhere = {
            paidAt: { gte: startDate, lte: endDate },
            amount: { gt: 0 },
            subscriptionId: { not: null },
            status: { in: ['completed', 'COMPLETED', 'paid', 'PAID'] }
        };

        if (normalizedMethod && normalizedMethod !== 'all') {
            paymentWhere.method = normalizedMethod;
        }

        if (staffId && staffId !== 'all') {
            const parsedStaffId = parseInt(staffId, 10);
            if (!Number.isInteger(parsedStaffId)) {
                return res.status(400).json({ success: false, message: 'Invalid staff ID' });
            }
            paymentWhere.createdBy = parsedStaffId;
        }

        if (q && String(q).trim()) {
            const search = String(q).trim();
            paymentWhere.member = {
                OR: [
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { phone: { contains: search } },
                    { memberId: { contains: search } },
                    { email: { contains: search } }
                ]
            };
        }

        const candidatePayments = await req.prisma.payment.findMany({
            where: paymentWhere,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        email: true
                    }
                },
                subscription: {
                    select: {
                        id: true,
                        price: true,
                        plan: { select: { name: true, price: true } }
                    }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true }
                }
            },
            orderBy: { paidAt: 'asc' }
        });

        if (candidatePayments.length === 0) {
            return res.json({
                success: true,
                data: {
                    rows: [],
                    summary: {
                        totalPaid: 0,
                        paymentCount: 0,
                        fullySettledCount: 0,
                        partiallySettledCount: 0
                    }
                }
            });
        }

        const candidateMap = new Map();
        const subscriptionInfo = new Map();
        const subscriptionIds = new Set();
        const memberIds = new Set();

        candidatePayments.forEach((payment) => {
            candidateMap.set(payment.id, payment);
            if (payment.subscriptionId) {
                subscriptionIds.add(payment.subscriptionId);
            }
            if (payment.member?.id) {
                memberIds.add(payment.member.id);
            }
            if (payment.subscription) {
                const price = payment.subscription.price != null
                    ? payment.subscription.price
                    : (payment.subscription.plan?.price || 0);
                subscriptionInfo.set(payment.subscription.id, {
                    price,
                    planName: payment.subscription.plan?.name || null
                });
            }
        });

        const subscriptionIdList = Array.from(subscriptionIds);
        const memberIdList = Array.from(memberIds);

        const allPayments = await req.prisma.payment.findMany({
            where: {
                subscriptionId: { in: subscriptionIdList },
                amount: { gt: 0 },
                status: { in: ['completed', 'COMPLETED', 'paid', 'PAID'] },
                paidAt: { lte: endDate }
            },
            select: {
                id: true,
                subscriptionId: true,
                amount: true,
                paidAt: true,
                createdAt: true
            }
        });

        const refunds = await req.prisma.refund.findMany({
            where: {
                createdAt: { lte: endDate },
                payment: { subscriptionId: { in: subscriptionIdList } }
            },
            select: {
                id: true,
                amount: true,
                createdAt: true,
                payment: { select: { subscriptionId: true } }
            }
        });

        const checkIns = await req.prisma.checkIn.findMany({
            where: {
                memberId: { in: memberIdList }
            },
            select: { memberId: true, checkInTime: true }
        });

        const visitMap = new Map();
        checkIns.forEach((checkIn) => {
            const entry = visitMap.get(checkIn.memberId) || { count: 0, lastVisit: null };
            entry.count += 1;
            if (!entry.lastVisit || new Date(checkIn.checkInTime) > new Date(entry.lastVisit)) {
                entry.lastVisit = checkIn.checkInTime;
            }
            visitMap.set(checkIn.memberId, entry);
        });

        const eventsBySubscription = new Map();
        allPayments.forEach((payment) => {
            const list = eventsBySubscription.get(payment.subscriptionId) || [];
            list.push({
                type: 'payment',
                at: payment.paidAt || payment.createdAt,
                amount: Number(payment.amount) || 0,
                paymentId: payment.id
            });
            eventsBySubscription.set(payment.subscriptionId, list);
        });

        refunds.forEach((refund) => {
            const subscriptionId = refund.payment?.subscriptionId;
            if (!subscriptionId) return;
            const list = eventsBySubscription.get(subscriptionId) || [];
            list.push({
                type: 'refund',
                at: refund.createdAt,
                amount: Number(refund.amount) || 0
            });
            eventsBySubscription.set(subscriptionId, list);
        });

        const rows = [];

        eventsBySubscription.forEach((events, subscriptionId) => {
            const info = subscriptionInfo.get(subscriptionId) || { price: 0, planName: null };
            let netPaid = 0;

            events.sort((a, b) => {
                const aTime = new Date(a.at).getTime();
                const bTime = new Date(b.at).getTime();
                if (aTime !== bTime) return aTime - bTime;
                if (a.type === b.type) return (a.paymentId || 0) - (b.paymentId || 0);
                return a.type === 'payment' ? -1 : 1;
            });

            events.forEach((event) => {
                if (event.type === 'payment') {
                    const dueBefore = Math.max(0, info.price - netPaid);
                    const payment = candidateMap.get(event.paymentId);
                    if (payment && dueBefore > 0) {
                        const remainingAfter = Math.max(0, dueBefore - event.amount);
                        const settlementType = remainingAfter <= 0 ? 'full' : 'partial';

                        if (normalizedType && normalizedType !== 'all' && normalizedType !== settlementType) {
                            netPaid += event.amount;
                            return;
                        }

                        const memberName = payment.member
                            ? `${payment.member.firstName} ${payment.member.lastName}`
                            : 'Unknown';
                        const staffName = payment.creator
                            ? `${payment.creator.firstName} ${payment.creator.lastName}`
                            : (payment.collectorName || null);
                        const visitInfo = payment.member?.id ? visitMap.get(payment.member.id) : null;

                        rows.push({
                            id: payment.id,
                            paidAt: payment.paidAt || payment.createdAt,
                            member: {
                                id: payment.member?.id || null,
                                memberId: payment.member?.memberId || null,
                                name: memberName,
                                phone: payment.member?.phone || null,
                                email: payment.member?.email || null
                            },
                            subscription: {
                                id: payment.subscription?.id || subscriptionId,
                                planName: info.planName
                            },
                            dueBefore,
                            paidAmount: event.amount,
                            remainingAfter,
                            method: (payment.method || 'cash').toLowerCase(),
                            staff: {
                                id: payment.creator?.id || null,
                                name: staffName
                            },
                            reference: {
                                receiptNumber: payment.receiptNumber || null,
                                externalReference: payment.externalReference || null,
                                transactionRef: payment.transactionRef || null
                            },
                            visits: {
                                count: visitInfo?.count || 0,
                                lastVisit: visitInfo?.lastVisit || null
                            },
                            settlementType
                        });
                    }
                    netPaid += event.amount;
                } else {
                    netPaid = Math.max(0, netPaid - event.amount);
                }
            });
        });

        const totalPaid = rows.reduce((sum, row) => sum + (row.paidAmount || 0), 0);
        const fullySettledCount = rows.filter(row => row.settlementType === 'full').length;
        const partiallySettledCount = rows.filter(row => row.settlementType === 'partial').length;

        res.json({
            success: true,
            data: {
                rows,
                summary: {
                    totalPaid,
                    paymentCount: rows.length,
                    fullySettledCount,
                    partiallySettledCount
                }
            }
        });
    } catch (error) {
        console.error('[REPORTS] Settled payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report'
        });
    }
});

/**
 * GET /api/reports/refunds
 * Refunds report with filters
 */
router.get('/refunds', async (req, res) => {
    try {
        const { from, to, startDate: startDateParam, endDate: endDateParam, search, adminId, format } = req.query;

        // Build where clause
        const where = {};

        const rangeFrom = from || startDateParam;
        const rangeTo = to || endDateParam;
        let startDate;
        let endDate;

        if (rangeFrom && rangeTo) {
            const parsed = parseDateRange(rangeFrom, rangeTo);
            if (parsed.error) {
                return res.status(400).json({ success: false, message: parsed.error });
            }
            startDate = parsed.startDate;
            endDate = parsed.endDate;
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        if (adminId && adminId !== 'all') {
            where.createdBy = parseInt(adminId);
        }

        // Fetch refunds
        const refunds = await req.prisma.refund.findMany({
            where,
            include: {
                payment: {
                    include: {
                        member: {
                            select: {
                                id: true,
                                memberId: true,
                                firstName: true,
                                lastName: true,
                                gender: true
                            }
                        },
                        subscription: {
                            include: {
                                plan: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Also include legacy refund entries stored as negative payments
        const paymentWhere = {
            amount: { lt: 0 }
        };
        if (startDate && endDate) {
            paymentWhere.paidAt = {
                gte: startDate,
                lte: endDate
            };
        }
        if (adminId && adminId !== 'all') {
            paymentWhere.createdBy = parseInt(adminId);
        }

        const negativePayments = await req.prisma.payment.findMany({
            where: paymentWhere,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        gender: true
                    }
                },
                subscription: {
                    include: {
                        plan: {
                            select: { name: true }
                        }
                    }
                },
                creator: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                paidAt: 'desc'
            }
        });

        const extractReason = (notes) => {
            if (!notes) return null;
            const match = notes.match(/Reason:\s*(.*)$/i);
            return match ? match[1].trim() : notes;
        };

        // Build subscription totals for negative payments when possible
        const subscriptionTotals = new Map();
        const subscriptionIds = Array.from(new Set(
            negativePayments.map(p => p.subscriptionId).filter(id => Number.isInteger(id))
        ));

        if (subscriptionIds.length > 0) {
            const subscriptionPayments = await req.prisma.payment.findMany({
                where: {
                    subscriptionId: { in: subscriptionIds }
                },
                select: {
                    subscriptionId: true,
                    amount: true,
                    refunds: {
                        select: { amount: true }
                    }
                }
            });

            subscriptionPayments.forEach(payment => {
                if (!payment.subscriptionId) return;
                const totals = subscriptionTotals.get(payment.subscriptionId) || { paid: 0, refunded: 0 };

                if (payment.amount > 0) {
                    totals.paid += payment.amount;
                } else if (payment.amount < 0) {
                    totals.refunded += Math.abs(payment.amount);
                }

                if (payment.refunds && payment.refunds.length > 0) {
                    totals.refunded += payment.refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
                }

                subscriptionTotals.set(payment.subscriptionId, totals);
            });
        }

        // Calculate summary
        const refundRows = refunds.map(refund => ({
            id: `refund-${refund.id}`,
            amount: refund.amount,
            reason: refund.reason,
            refundedAt: refund.createdAt, // Frontend expects this key
            member: refund.payment?.member ? {
                id: refund.payment.member.id,
                memberId: refund.payment.member.memberId,
                name: `${refund.payment.member.firstName} ${refund.payment.member.lastName}`,
                gender: refund.payment.member.gender || 'unknown',
                code: refund.payment.member.memberId
            } : { name: 'Unknown', code: '---' },
            subscription: refund.payment?.subscription ? {
                name: refund.payment.subscription.plan?.name || 'Unknown Plan'
            } : { name: 'N/A' },
            processedBy: refund.user ? {
                name: `${refund.user.firstName} ${refund.user.lastName}`
            } : { name: 'System' },
            method: (refund.payment?.method || 'cash').toLowerCase(),
            originalPaid: refund.payment?.amount || 0,
            totalRefundedSoFar: refund.payment?.refundedTotal || 0,
            netRemaining: (refund.payment?.amount || 0) - (refund.payment?.refundedTotal || 0),
            receiptId: refund.payment?.receiptNumber
        }));

        const negativePaymentRows = negativePayments.map(payment => {
            const totals = payment.subscriptionId ? subscriptionTotals.get(payment.subscriptionId) : null;
            const totalPaid = totals?.paid || 0;
            const totalRefunded = totals?.refunded || Math.abs(payment.amount || 0);
            const netRemaining = Math.max(0, totalPaid - totalRefunded);

            return {
                id: `payment-${payment.id}`,
                amount: Math.abs(payment.amount || 0),
                reason: extractReason(payment.notes),
                refundedAt: payment.paidAt || payment.createdAt,
                member: payment.member ? {
                    id: payment.member.id,
                    memberId: payment.member.memberId,
                    name: `${payment.member.firstName} ${payment.member.lastName}`,
                    gender: payment.member.gender || 'unknown',
                    code: payment.member.memberId
                } : { name: 'Unknown', code: '---' },
                subscription: payment.subscription ? {
                    name: payment.subscription.plan?.name || 'Unknown Plan'
                } : { name: 'N/A' },
                processedBy: payment.creator ? {
                    name: `${payment.creator.firstName} ${payment.creator.lastName}`
                } : { name: payment.collectorName || 'System' },
                method: (payment.method || 'cash').toLowerCase(),
                originalPaid: totalPaid,
                totalRefundedSoFar: totalRefunded,
                netRemaining,
                receiptId: payment.receiptNumber
            };
        });

        let rows = [...refundRows, ...negativePaymentRows];

        if (search) {
            const searchLower = search.toLowerCase();
            rows = rows.filter(r => {
                const memberName = r.member?.name?.toLowerCase() || '';
                const memberId = r.member?.memberId?.toLowerCase() || '';
                return memberName.includes(searchLower) || memberId.includes(searchLower);
            });
        }

        rows.sort((a, b) => new Date(b.refundedAt) - new Date(a.refundedAt));

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthRefunds = rows.filter(r => r.refundedAt && new Date(r.refundedAt) >= startOfMonth);

        const summary = {
            totalRefunded: rows.reduce((sum, r) => sum + (r.amount || 0), 0),
            thisMonthTotal: thisMonthRefunds.reduce((sum, r) => sum + (r.amount || 0), 0),
            count: rows.length
        };
        const totals = summary;

        if (req.query.format === 'excel') {
            const excelRows = rows.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'refunds-report.xlsx');
        }

        res.json({
            success: true,
            data: {
                rows,
                summary,
                totals
            }
        });

    } catch (error) {
        console.error('[REPORTS] Refunds error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate refunds report'
        });
    }
});

/**
 * GET /api/reports/payments/summary
 * Summary of payments by method (Cash, Card, Transfer)
 */
router.get('/payments/summary', async (req, res) => {
    try {
        const { from, to, employeeId } = req.query;

        const { startDate, endDate, error } = parseDateRange(from, to);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const statusFilter = ['completed', 'refunded', 'Partial Refund', 'COMPLETED', 'REFUNDED', 'PARTIAL REFUND'];
        const dateRange = { gte: startDate, lte: endDate };
        const where = {
            status: { in: statusFilter },
            OR: [
                { paidAt: dateRange },
                { createdAt: dateRange }
            ]
        };

        if (employeeId && employeeId !== 'all') {
            where.createdBy = parseInt(employeeId);
        }

        // Fetch payments
        const payments = await req.prisma.payment.findMany({
            where,
            select: {
                amount: true,
                method: true,
                status: true,
                refundedTotal: true
            }
        });

        // Group by method
        const SUMMARY_TEMPLATE = { count: 0, amount: 0 };
        const data = {
            byMethod: {
                cash: { ...SUMMARY_TEMPLATE },
                card: { ...SUMMARY_TEMPLATE },
                transfer: { ...SUMMARY_TEMPLATE },
                other: { ...SUMMARY_TEMPLATE }
            },
            total: {
                count: 0,
                amount: 0,
                refunded: 0,
                net: 0
            }
        };

        payments.forEach(p => {
            let method = (p.method || 'other').toLowerCase();
            if (!data.byMethod[method]) method = 'other';

            const amount = p.amount || 0;
            const refunded = p.refundedTotal || 0;

            // Only count + amount for valid payments (handle refunds logic if needed)
            // Assuming amount is Gross Paid.

            data.byMethod[method].count++;
            data.byMethod[method].amount += amount;

            data.total.count++;
            data.total.amount += amount;
            data.total.refunded += refunded;
        });

        data.total.net = data.total.amount - data.total.refunded;

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json({
            success: true,
            data: {
                ...data, // Original structure
                // Frontend Aliases (to match Frontend expectations)
                successCount: data.total.count,
                successAmountTotal: data.total.amount,
                successNetTotal: data.total.net
            }
        });

    } catch (error) {
        console.error('[REPORTS] Payments summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate payments summary'
        });
    }
});

/**
 * GET /api/reports/members
 * New members report
 */
router.get('/members', async (req, res) => {
    try {
        const { startDate, endDate, from, to, search } = req.query;
        // Default to last 30 days if no date provided
        const { startDate: start, endDate: end, error } = parseDateRange(startDate || from, endDate || to);

        if (error) {
            // Fallback to safe defaults if dates are invalid
            // But here let's validly returning nothing or last 30 days logic?
            // parseDateRange handles defaults (7 days? or just validation?)
            // Inspecting parseDateRange logic previously: it validates.
            // If error, return 400.
            return res.status(400).json({ success: false, message: error });
        }

        const where = {
            joinDate: {
                gte: start,
                lte: end
            }
        };

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { memberId: { contains: search, mode: 'insensitive' } }
            ];
        }

        const members = await req.prisma.member.findMany({
            where,
            include: {
                subscriptions: {
                    where: { status: 'active' },
                    take: 1,
                    include: { plan: true }
                }
            },
            orderBy: { joinDate: 'desc' }
        });

        // Format for Generic Report Table
        const report = members.map(m => ({
            id: m.id,
            name: `${m.firstName} ${m.lastName}`,
            memberId: m.memberId,
            memberId: m.memberId,
            phone: m.phone || '',
            gender: m.gender || 'unknown',
            joinDate: m.joinDate,
            gender: m.gender || 'N/A',
            activePlan: m.subscriptions[0]?.plan?.name || 'None',
            status: m.isActive ? 'active' : 'inactive'
        }));

        const summary = {
            totalNewMembers: members.length,
            activeMembers: members.filter(m => m.isActive).length
        };

        if (req.query.format === 'excel') {
            const excelRows = report.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'members-report.xlsx');
        }

        res.json({
            success: true,
            data: { summary, report }
        });

    } catch (error) {
        console.error('[REPORTS] Members report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate members report' });
    }
});

/**
 * GET /api/reports/attendance
 * Attendance (Check-in) report
 */
router.get('/attendance', async (req, res) => {
    try {
        const { startDate, endDate, from, to, search } = req.query;
        const { startDate: start, endDate: end, error } = parseDateRange(startDate || from, endDate || to);

        if (error) return res.status(400).json({ success: false, message: error });

        const where = {
            checkInTime: {
                gte: start,
                lte: end
            }
        };

        if (search) {
            where.member = {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { memberId: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const checkins = await req.prisma.checkIn.findMany({
            where,
            include: {
                member: {
                    select: {
                        firstName: true,
                        lastName: true,
                        memberId: true,
                        gender: true,
                        subscriptions: {
                            where: { status: 'active' },
                            take: 1,
                            include: { plan: { select: { name: true } } }
                        }
                    }
                }
            },
            orderBy: { checkInTime: 'desc' }
        });

        const report = checkins.map(c => ({
            id: c.id,
            checkIn: c.checkInTime,
            checkOut: c.checkOutTime || 'N/A',
            memberName: c.member ? `${c.member.firstName} ${c.member.lastName}` : 'Unknown',
            memberId: c.member?.memberId || 'N/A',
            gender: c.member?.gender || 'unknown',
            plan: c.member?.subscriptions?.[0]?.plan?.name || 'N/A',
            method: c.method || 'manual'
        }));

        const summary = {
            totalCheckins: checkins.length,
            uniqueMembers: new Set(checkins.map(c => c.memberId)).size
        };

        if (req.query.format === 'excel') {
            const excelRows = report.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'attendance-report.xlsx');
        }

        res.json({
            success: true,
            data: { summary, report }
        });

    } catch (error) {
        console.error('[REPORTS] Attendance report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate attendance report' });
    }
});

/**
 * GET /api/reports/subscriptions
 * Subscriptions report
 */
router.get('/subscriptions', async (req, res) => {
    try {
        const { startDate, endDate, from, to, search, method } = req.query;
        const { startDate: start, endDate: end, error } = parseDateRange(startDate || from, endDate || to);

        if (error) return res.status(400).json({ success: false, message: error });

        const where = {
            startDate: {
                gte: start,
                lte: end
            }
        };

        if (search) {
            where.member = {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { memberId: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const subscriptions = await req.prisma.subscription.findMany({
            where,
            include: {
                member: { select: { firstName: true, lastName: true, memberId: true, gender: true } },
                plan: { select: { name: true, price: true } }
            },
            orderBy: { startDate: 'desc' }
        });

        const report = subscriptions.map(s => ({
            id: s.id,
            memberName: s.member ? `${s.member.firstName} ${s.member.lastName}` : 'Unknown',
            memberId: s.member?.memberId || 'N/A',
            gender: s.member?.gender || 'unknown',
            plan: s.plan?.name || 'Unknown',
            price: s.price || s.plan?.price || 0,
            startDate: s.startDate,
            endDate: s.endDate,
            status: s.status
        }));

        const summary = {
            totalSubscriptions: subscriptions.length,
            totalRevenue: subscriptions.reduce((sum, s) => sum + (s.price || 0), 0)
        };

        if (req.query.format === 'excel') {
            const excelRows = report.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'subscriptions-report.xlsx');
        }

        res.json({
            success: true,
            data: { summary, report }
        });

    } catch (error) {
        console.error('[REPORTS] Subscriptions report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate subscriptions report' });
    }
});

/**
 * GET /api/reports/cancellations
 * List subscriptions canceled within a given period
 */
router.get('/cancellations', async (req, res) => {
    try {
        const { from, to, startDate: startDateParam, endDate: endDateParam, search } = req.query;
        const { startDate, endDate, error } = parseDateRange(from || startDateParam, to || endDateParam);
        if (error) return res.status(400).json({ success: false, message: error });

        const where = {
            canceledAt: {
                gte: startDate,
                lte: endDate
            },
            status: { in: ['cancelled', 'ended'] }
        };

        if (search) {
            where.member = {
                OR: [
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { memberId: { contains: search } },
                    { phone: { contains: search } }
                ]
            };
        }

        const cancellations = await req.prisma.subscription.findMany({
            where,
            include: {
                member: { select: { id: true, firstName: true, lastName: true, memberId: true, phone: true } },
                plan: { select: { name: true } },
                canceledBy: { select: { firstName: true, lastName: true } },
                payments: {
                    include: { refunds: true },
                    where: { status: { in: ['completed', 'refunded', 'Partial Refund'] } }
                }
            },
            orderBy: { canceledAt: 'desc' }
        });

        const report = cancellations.map(c => {
            const paidAmount = c.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const refundedAmount = c.payments.reduce((sum, p) => sum + (p.refundedTotal || 0), 0);
            const netRevenue = paidAmount - refundedAmount;

            return {
                id: c.id,
                canceledAt: c.canceledAt,
                cancelReason: c.cancelReason,
                cancelSource: c.cancelSource,
                status: c.status,
                startDate: c.startDate,
                endDate: c.endDate,
                member: {
                    id: c.member.id,
                    name: `${c.member.firstName} ${c.member.lastName}`,
                    memberId: c.member.memberId,
                    phone: c.member.phone
                },
                plan: {
                    name: c.plan.name
                },
                financials: {
                    paidAmount,
                    refundedAmount,
                    netRevenue
                },
                processedBy: c.canceledBy ? `${c.canceledBy.firstName} ${c.canceledBy.lastName}` : 'System'
            };
        });

        const summary = {
            totalCancellations: report.length,
            totalRefunded: report.reduce((sum, r) => sum + r.financials.refundedAmount, 0),
            netRevenueImpact: report.reduce((sum, r) => sum + r.financials.netRevenue, 0)
        };

        if (req.query.format === 'excel') {
            const excelRows = report.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'cancellations-report.xlsx');
        }

        res.json({
            success: true,
            data: { summary, report }
        });

    } catch (error) {
        console.error('[REPORTS] Cancellations report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate cancellations report' });
    }
});

/**
 * GET /api/reports/ledger
 * Payment/Refund ledger for a member or subscription
 * Returns timeline of all transactions with running totals
 */
router.get('/ledger', async (req, res) => {
    try {
        const { memberId, subscriptionId, from, to } = req.query;

        // Build payment where clause
        const paymentWhere = {
            status: { in: ['completed', 'refunded', 'Partial Refund'] }
        };

        // Build refund where clause
        const refundWhere = {};

        // Scope by subscription or member
        if (subscriptionId) {
            paymentWhere.subscriptionId = parseInt(subscriptionId);
            // Refunds are linked via payment, we filter later
        } else if (memberId) {
            paymentWhere.memberId = parseInt(memberId);
        } else {
            // Neither provided - return empty with valid structure
            return res.json({
                success: true,
                data: {
                    summary: {
                        totalPaid: 0,
                        totalRefunded: 0,
                        totalDue: 0,
                        net: 0,
                        remaining: 0,
                        subscriptionTotal: 0,
                        byMethod: { cash: 0, card: 0, transfer: 0 }
                    },
                    events: []
                }
            });
        }

        // Date range filter
        if (from && to) {
            const { startDate, endDate, error } = parseDateRange(from, to);
            if (!error) {
                paymentWhere.paidAt = { gte: startDate, lte: endDate };
            }
        }

        // Fetch payments
        const payments = await req.prisma.payment.findMany({
            where: paymentWhere,
            include: {
                subscription: {
                    include: {
                        plan: { select: { name: true, price: true } }
                    }
                },
                creator: {
                    select: { firstName: true, lastName: true }
                },
                refunds: {
                    include: {
                        user: { select: { firstName: true, lastName: true } }
                    }
                }
            },
            orderBy: { paidAt: 'asc' }
        });

        // Build events timeline
        const events = [];
        let runningPaid = 0;
        let runningRefunded = 0;
        let subscriptionTotal = 0;
        const byMethod = { cash: 0, card: 0, transfer: 0 };

        // Calculate subscription total if scoped
        if (subscriptionId) {
            const sub = await req.prisma.subscription.findUnique({
                where: { id: parseInt(subscriptionId) },
                include: { plan: true }
            });
            subscriptionTotal = sub?.price || sub?.plan?.price || 0;
        } else if (memberId) {
            // Sum all subscription prices for this member
            const subs = await req.prisma.subscription.findMany({
                where: { memberId: parseInt(memberId) },
                include: { plan: true }
            });
            subscriptionTotal = subs.reduce((sum, s) => sum + (s.price || s.plan?.price || 0), 0);
        }

        // Process payments and their refunds
        payments.forEach(payment => {
            const method = (payment.method || 'cash').toLowerCase();
            const paymentAmount = payment.amount || 0;

            runningPaid += paymentAmount;
            if (byMethod[method] !== undefined) {
                byMethod[method] += paymentAmount;
            }

            const remaining = Math.max(0, subscriptionTotal - (runningPaid - runningRefunded));

            // Add payment event
            events.push({
                id: `payment-${payment.id}`,
                type: 'payment',
                date: payment.paidAt,
                amount: paymentAmount,
                method: method,
                receiptNumber: payment.receiptNumber,
                notes: payment.notes,
                employee: payment.creator
                    ? `${payment.creator.firstName} ${payment.creator.lastName}`
                    : (payment.collectorName || 'N/A'),
                subscription: payment.subscription ? {
                    id: payment.subscription.id,
                    planName: payment.subscription.plan?.name || 'N/A'
                } : null,
                runningPaid,
                runningRefunded,
                net: runningPaid - runningRefunded,
                remainingAfter: remaining
            });

            // Add refund events
            if (payment.refunds && payment.refunds.length > 0) {
                payment.refunds.forEach(refund => {
                    const refundAmount = refund.amount || 0;
                    runningRefunded += refundAmount;

                    // Deduct from method breakdown
                    if (byMethod[method] !== undefined) {
                        byMethod[method] -= refundAmount;
                    }

                    const remainingAfterRefund = Math.max(0, subscriptionTotal - (runningPaid - runningRefunded));

                    events.push({
                        id: `refund-${refund.id}`,
                        type: 'refund',
                        date: refund.createdAt,
                        amount: -refundAmount,
                        method: method,
                        receiptNumber: payment.receiptNumber,
                        notes: refund.reason,
                        employee: refund.user
                            ? `${refund.user.firstName} ${refund.user.lastName}`
                            : 'N/A',
                        subscription: payment.subscription ? {
                            id: payment.subscription.id,
                            planName: payment.subscription.plan?.name || 'N/A'
                        } : null,
                        runningPaid,
                        runningRefunded,
                        net: runningPaid - runningRefunded,
                        remainingAfter: remainingAfterRefund
                    });
                });
            }
        });

        // Sort all events by date
        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Build summary
        const summary = {
            totalPaid: runningPaid,
            totalRefunded: runningRefunded,
            totalDue: subscriptionTotal,
            net: runningPaid - runningRefunded,
            remaining: Math.max(0, subscriptionTotal - (runningPaid - runningRefunded)),
            subscriptionTotal,
            byMethod
        };

        if (req.query.format === 'excel') {
            const excelRows = events.map(e => flattenRow(e));
            return sendExcelResponse(res, excelRows, 'ledger-report.xlsx');
        }

        res.json({
            success: true,
            data: {
                summary,
                events
            }
        });

    } catch (error) {
        console.error('[REPORTS] Ledger error:', error.message, error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to generate ledger',
            code: 'LEDGER_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * GET /api/reports/payInOut
 * Pay In / Pay Out Report
 */
router.get('/payInOut', async (req, res) => {
    try {
        const { from, to, startDate: startDateParam, endDate: endDateParam, type, shiftId, scope } = req.query;
        // Support flexible date params
        const { startDate, endDate, error } = parseDateRange(from || startDateParam, to || endDateParam);

        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const where = {};

        // Date Filter
        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        // Type Filter (IN, OUT, or all)
        if (type && type !== 'all') {
            where.type = type;
        }

        // Context Filters
        if (shiftId) {
            where.shiftId = parseInt(shiftId);
        } else if (scope === 'currentShift' && req.activeShift) { // If middleware attached or we look it up
            // If we really need current shift logic here, usually passed from frontend or found via activeShift
            // But reports usually are just filtered by date or explicit shiftId. 
            // If scope passed, handled by frontend sending dates? 
            // Let's assume frontend handled dates or passed shiftId.
        }

        const movements = await req.prisma.cashMovement.findMany({
            where,
            include: {
                employee: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                shift: {
                    select: { id: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate Summary
        const summary = {
            totalIn: movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.amount, 0),
            totalOut: movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.amount, 0),
            count: movements.length
        };
        summary.net = summary.totalIn - summary.totalOut;

        // Map Rows for Report Table
        const rows = movements.map(m => ({
            id: m.id,
            type: m.type,
            amount: m.amount,
            reason: m.reason,
            notes: m.notes,
            createdAt: m.createdAt,
            employeeName: m.employee ? `${m.employee.firstName} ${m.employee.lastName}` : 'Unknown',
            shiftId: m.shiftId
        }));

        if (req.query.format === 'excel') {
            const excelRows = rows.map(r => flattenRow(r));
            return sendExcelResponse(res, excelRows, 'pay-in-out-report.xlsx');
        }

        res.json({
            success: true,
            data: {
                summary,
                rows // Frontend expects 'rows'
            }
        });

    } catch (error) {
        console.error('[REPORTS] Pay In/Out error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate Pay In/Out report' });
    }
});


/**
 * GET /api/reports/sales/products
 * Sales summary by product - Placeholder or Deprecated
 */

/**
 * GET /api/reports/employee-collections
 * Collections by employee (broken down by method)
 */
router.get('/employee-collections', async (req, res) => {
    try {
        const { startDate, endDate, from, to, employeeId, method } = req.query;
        const { startDate: start, endDate: end, error } = parseDateRange(startDate || from, endDate || to);

        if (error) return res.status(400).json({ success: false, message: error });

        const where = {
            paidAt: { gte: start, lte: end },
            status: { in: ['completed', 'refunded', 'Partial Refund'] }
        };

        if (employeeId && employeeId !== 'all') {
            where.createdBy = parseInt(employeeId);
        }

        if (method) {
            where.method = method;
        }

        // Fetch payments with creators
        const payments = await req.prisma.payment.findMany({
            where,
            include: {
                creator: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        });

        // Aggregation
        const employeeMap = {};

        payments.forEach(p => {
            const empId = p.creatorId || 'system';
            if (!employeeMap[empId]) {
                employeeMap[empId] = {
                    id: empId,
                    name: p.creator ? `${p.creator.firstName} ${p.creator.lastName}` : 'System/Online',
                    count: 0,
                    cash: 0,
                    nonCash: 0,
                    total: 0
                };
            }

            const amount = p.amount || 0; // Gross collected
            // If we care about Net, subtract refunds. For Collections, usually Gross is counted (cash in hand).
            // Let's stick to Gross for "Collections".

            employeeMap[empId].count++;
            employeeMap[empId].total += amount;

            if ((p.method || 'cash').toLowerCase() === 'cash') {
                employeeMap[empId].cash += amount;
            } else {
                employeeMap[empId].nonCash += amount;
            }
        });

        const report = Object.values(employeeMap);

        if (req.query.format === 'excel') {
            return sendExcelResponse(res, report, 'employee-collections.xlsx');
        }

        res.json({
            success: true,
            report // Frontend expects 'report' array
        });

    } catch (error) {
        console.error('[REPORTS] Employee Collections error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report' });
    }
});

/**
 * GET /api/reports/receipts/lookup
 * Search for a receipt by number or transaction ref
 */
router.get('/receipts/lookup', async (req, res) => {
    try {
        const { q, scope } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query required' });

        const query = q.trim();

        // Find payment
        const payment = await req.prisma.payment.findFirst({
            where: {
                OR: [
                    { receiptNumber: { equals: query, mode: 'insensitive' } },
                    { transactionRef: { equals: query, mode: 'insensitive' } },
                    { externalReference: { equals: query, mode: 'insensitive' } },
                    // Maybe ID?
                    ...(parseInt(query) ? [{ id: parseInt(query) }] : [])
                ]
            },
            include: {
                member: true,
                subscription: { include: { plan: true } },
                creator: { select: { id: true, firstName: true, lastName: true } },
                shift: true,
                refunds: {
                    include: { user: { select: { firstName: true, lastName: true } } }
                }
            }
        });

        if (!payment) {
            return res.json({ success: false, message: 'Receipt not found' });
        }

        // Calculate computed fields
        const refundedTotal = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
        const originalPaid = payment.amount;

        let status = 'Paid';
        if (payment.status === 'refunded' || (refundedTotal >= originalPaid && originalPaid > 0)) status = 'Refunded';
        else if (refundedTotal > 0) status = 'Partial Refund';

        const data = {
            payment,
            member: payment.member ? {
                id: payment.member.id,
                name: `${payment.member.firstName} ${payment.member.lastName}`,
                code: payment.member.memberId,
                phone: payment.member.phone
            } : null,
            subscription: payment.subscription ? {
                planName: payment.subscription.plan?.name,
                duration: 30 // Approximate or calc
            } : null,
            paidBy: payment.creator ? {
                name: `${payment.creator.firstName} ${payment.creator.lastName}`
            } : { name: 'System' },
            shift: payment.shift,
            refunds: payment.refunds.map(r => ({
                id: r.id,
                amount: r.amount,
                reason: r.reason,
                createdAt: r.createdAt,
                refundedBy: r.user ? `${r.user.firstName} ${r.user.lastName}` : 'System'
            })),
            computed: {
                status,
                originalPaid,
                refundedTotal,
                remainingBalance: originalPaid - refundedTotal
            }
        };

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('[REPORTS] Receipt lookup error:', error);
        res.status(500).json({ success: false, message: 'Lookup failed' });
    }
});

/**
 * GET /api/reports/sales/detailed
 * Detailed product sales report (flattens transactions to line items)
 */
router.get('/sales/detailed', async (req, res) => {
    try {
        const { from, to, search, limit } = req.query;

        // Date Filtering
        const { startDate, endDate, error } = parseDateRange(from, to);
        if (error) return res.status(400).json({ success: false, message: error });

        const where = {};
        if (startDate && endDate) {
            where.createdAt = {
                gte: startDate,
                lte: endDate
            };
        }

        // Fetch Transactions with Items
        const sales = await req.prisma.saleTransaction.findMany({
            where,
            include: {
                items: {
                    include: {
                        product: { select: { name: true, sku: true } }
                    }
                },
                employee: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit ? parseInt(limit) : undefined
        });

        // Flatten to Line Items
        let rows = [];
        let summary = {
            totalRevenue: 0,
            totalUnits: 0,
            uniqueProducts: new Set()
        };

        sales.forEach(sale => {
            sale.items.forEach(item => {
                const productName = item.product?.name || item.snapshotName || 'Unknown Product';
                const sku = item.product?.sku || 'N/A';

                // Search Filter (In-Memory for simplicity on flattened data)
                if (search) {
                    const q = search.toLowerCase();
                    if (!productName.toLowerCase().includes(q) && !sku.toLowerCase().includes(q)) {
                        return;
                    }
                }

                // Add to Summary
                summary.totalRevenue += (item.lineTotal || 0);
                summary.totalUnits += (item.quantity || 0);
                summary.uniqueProducts.add(item.productId);

                rows.push({
                    id: `${sale.id}-${item.id}`,
                    date: sale.createdAt,
                    transactionId: sale.id,
                    productName,
                    sku,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.lineTotal,
                    soldBy: `${sale.employee?.firstName || ''} ${sale.employee?.lastName || ''}`.trim(),
                    paymentMethod: sale.paymentMethod
                });
            });
        });

        summary.uniqueProducts = summary.uniqueProducts.size;

        res.json({
            success: true,
            data: {
                rows,
                summary
            }
        });

    } catch (error) {
        console.error('[REPORTS] Sales detailed error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate product sales report' });
    }
});

module.exports = router;
