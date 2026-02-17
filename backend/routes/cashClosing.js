/**
 * ============================================
 * CASH CLOSING ROUTES
 * ============================================
 * 
 * Routes for cash reconciliation.
 * Some routes are accessible to staff for self-service.
 * Admin-only routes are protected by middleware.
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditService');
const { calculateDailyRevenue, calculateNetRevenue, calculateCashClosingStats, calculateFinancialSnapshot } = require('../utils/financialCalculations');
const { parseDateRange } = require('../utils/dateParams');


// All routes require authentication
router.use(authenticate);

function toSafeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function buildZeroFinancialPreviewSummary() {
    return {
        totalSessions: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        cardRevenue: 0,
        transferRevenue: 0,
        trainerCommissions: 0,
        payoutsTotal: 0,
        cashInTotal: 0,
        expectedCash: 0,
        expectedNonCash: 0
    };
}

function buildZeroExpectedStats() {
    return {
        expectedCashAmount: 0,
        expectedNonCashAmount: 0,
        expectedTotalAmount: 0,
        expectedCardAmount: 0,
        expectedTransferAmount: 0,
        cardTotal: 0,
        transferTotal: 0,
        paymentCount: 0,
        refundCount: 0,
        payoutsTotal: 0,
        payoutsCashTotal: 0,
        payoutsTransferTotal: 0,
        payoutsCardTotal: 0,
        cashInTotal: 0,
        cashOutTotal: 0,
        cashRefundsTotal: 0,
        nonCashRefundsTotal: 0
    };
}

function normalizeFinancialPreviewSummary(snapshot = {}) {
    return {
        totalSessions: parseInt(snapshot.totalSessions, 10) || 0,
        totalRevenue: toSafeNumber(snapshot.totalRevenue),
        cashRevenue: toSafeNumber(snapshot.cashRevenue),
        cardRevenue: toSafeNumber(snapshot.cardRevenue),
        transferRevenue: toSafeNumber(snapshot.transferRevenue),
        trainerCommissions: toSafeNumber(snapshot.trainerCommissions),
        payoutsTotal: toSafeNumber(snapshot.payoutsTotal),
        cashInTotal: toSafeNumber(snapshot.cashInTotal),
        expectedCash: toSafeNumber(snapshot.expectedCash),
        expectedNonCash: toSafeNumber(snapshot.expectedNonCash)
    };
}

function parseRangeOrFallback(startAt, endAt) {
    if (startAt || endAt) {
        const start = new Date(startAt);
        const end = new Date(endAt);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            if (start > end) return { start: end, end: start, valid: true };
            return { start, end, valid: true };
        }
    }

    const parsed = parseDateRange(startAt, endAt);
    if (parsed.error) {
        return { start: null, end: null, valid: false };
    }
    return { start: parsed.startDate, end: parsed.endDate, valid: true };
}

const PERIOD_STATUS = {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED'
};

const CLOSE_EXPORT_VERSION = 1;
const COMPLETED_PAYMENT_STATUSES = ['completed', 'paid', 'partial_refund', 'Partial Refund', 'refunded'];

function normalizePeriodType(value) {
    const normalized = String(value || 'MANUAL').trim().toUpperCase();
    if (['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'].includes(normalized)) {
        return normalized;
    }
    if (normalized === 'CUSTOM' || normalized === 'SHIFT') {
        return 'MANUAL';
    }
    return 'MANUAL';
}

function formatUserName(user) {
    if (!user) return null;
    const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return full || null;
}

function escapeCsvCell(value) {
    if (value === null || value === undefined) return '';
    const asString = String(value);
    if (/[",\n]/.test(asString)) {
        return `"${asString.replace(/"/g, '""')}"`;
    }
    return asString;
}

function parseSnapshotJson(value) {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

function normalizePeriodRow(period) {
    const differenceCash = toSafeNumber(period.differenceCash);
    let status = 'balanced';
    if (differenceCash < -0.01) status = 'shortage';
    else if (differenceCash > 0.01) status = 'overage';

    return {
        id: period.id,
        periodType: String(period.periodType || 'MANUAL').toLowerCase(),
        startAt: period.startAt,
        endAt: period.endAt || period.closedAt || period.startAt,
        createdAt: period.closedAt || period.createdAt,
        closedAt: period.closedAt || null,
        status,
        notes: period.notes || null,
        employeeName: formatUserName(period.closedByUser) || formatUserName(period.createdByUser) || 'System',
        expectedCashAmount: toSafeNumber(period.expectedCashAmount),
        expectedNonCashAmount: toSafeNumber(period.expectedNonCashAmount),
        expectedCardAmount: toSafeNumber(period.expectedCardAmount),
        expectedTransferAmount: toSafeNumber(period.expectedTransferAmount),
        expectedTotalAmount: toSafeNumber(period.expectedTotalAmount),
        declaredCashAmount: toSafeNumber(period.actualCashAmount),
        declaredNonCashAmount: toSafeNumber(period.actualNonCashAmount),
        declaredTotalAmount: toSafeNumber(period.actualTotalAmount),
        differenceCash: toSafeNumber(period.differenceCash),
        differenceNonCash: toSafeNumber(period.differenceNonCash),
        differenceTotal: toSafeNumber(period.differenceTotal),
        payoutsTotal: toSafeNumber(period.payoutsTotal),
        cashInTotal: toSafeNumber(period.cashInTotal),
        cashRefundsTotal: toSafeNumber(period.cashRefundsTotal),
        revenueTotal: toSafeNumber(period.revenueTotal),
        sessionsTotal: parseInt(period.sessionsTotal, 10) || 0,
        exportVersion: parseInt(period.exportVersion, 10) || CLOSE_EXPORT_VERSION
    };
}

function buildExportPayload(period) {
    const snapshot = parseSnapshotJson(period.snapshotJson);

    const totalsFromPeriod = {
        expectedCashAmount: toSafeNumber(period.expectedCashAmount),
        expectedNonCashAmount: toSafeNumber(period.expectedNonCashAmount),
        expectedCardAmount: toSafeNumber(period.expectedCardAmount),
        expectedTransferAmount: toSafeNumber(period.expectedTransferAmount),
        expectedTotalAmount: toSafeNumber(period.expectedTotalAmount),
        actualCashAmount: toSafeNumber(period.actualCashAmount),
        actualNonCashAmount: toSafeNumber(period.actualNonCashAmount),
        actualTotalAmount: toSafeNumber(period.actualTotalAmount),
        differenceCash: toSafeNumber(period.differenceCash),
        differenceNonCash: toSafeNumber(period.differenceNonCash),
        differenceTotal: toSafeNumber(period.differenceTotal),
        revenueTotal: toSafeNumber(period.revenueTotal),
        sessionsTotal: parseInt(period.sessionsTotal, 10) || 0,
        payoutsTotal: toSafeNumber(period.payoutsTotal),
        cashInTotal: toSafeNumber(period.cashInTotal),
        cashRefundsTotal: toSafeNumber(period.cashRefundsTotal),
        cashRevenue: toSafeNumber(period.cashRevenue),
        cardRevenue: toSafeNumber(period.cardRevenue),
        transferRevenue: toSafeNumber(period.transferRevenue)
    };

    return {
        meta: {
            closeId: period.id,
            periodType: period.periodType,
            status: period.status,
            startAt: period.startAt,
            endAt: period.endAt,
            createdAt: period.createdAt,
            closedAt: period.closedAt,
            exportVersion: parseInt(period.exportVersion, 10) || CLOSE_EXPORT_VERSION,
            createdBy: formatUserName(period.createdByUser),
            closedBy: formatUserName(period.closedByUser),
            notes: period.notes || null
        },
        totals: {
            ...totalsFromPeriod,
            ...(snapshot?.totals && typeof snapshot.totals === 'object' ? snapshot.totals : {})
        },
        breakdown: snapshot?.breakdown && typeof snapshot.breakdown === 'object'
            ? snapshot.breakdown
            : {}
    };
}

function buildExportCsv(payload) {
    const lines = [];
    lines.push('section,key,value');

    const meta = payload.meta || {};
    Object.entries(meta).forEach(([key, value]) => {
        lines.push(`meta,${escapeCsvCell(key)},${escapeCsvCell(value)}`);
    });

    const totals = payload.totals || {};
    Object.entries(totals).forEach(([key, value]) => {
        lines.push(`totals,${escapeCsvCell(key)},${escapeCsvCell(value)}`);
    });

    lines.push('');
    lines.push('payments,id,paidAt,method,amount,status,memberName');
    const paymentRows = payload.breakdown?.payments?.rows || [];
    paymentRows.forEach((row) => {
        lines.push([
            'payments',
            escapeCsvCell(row.id),
            escapeCsvCell(row.paidAt),
            escapeCsvCell(row.method),
            escapeCsvCell(row.amount),
            escapeCsvCell(row.status),
            escapeCsvCell(row.memberName || '')
        ].join(','));
    });

    lines.push('');
    lines.push('payouts,source,id,method,amount,createdAt,note');
    const payoutRows = payload.breakdown?.payouts?.rows || [];
    payoutRows.forEach((row) => {
        lines.push([
            'payouts',
            escapeCsvCell(row.source),
            escapeCsvCell(row.id),
            escapeCsvCell(row.method),
            escapeCsvCell(row.amount),
            escapeCsvCell(row.createdAt),
            escapeCsvCell(row.note || '')
        ].join(','));
    });

    lines.push('');
    lines.push('cash_in,source,id,amount,createdAt,note');
    const cashInRows = payload.breakdown?.cashIn?.rows || [];
    cashInRows.forEach((row) => {
        lines.push([
            'cash_in',
            escapeCsvCell(row.source),
            escapeCsvCell(row.id),
            escapeCsvCell(row.amount),
            escapeCsvCell(row.createdAt),
            escapeCsvCell(row.note || '')
        ].join(','));
    });

    lines.push('');
    lines.push('sales,id,createdAt,method,totalAmount');
    const salesRows = payload.breakdown?.sales?.rows || [];
    salesRows.forEach((row) => {
        lines.push([
            'sales',
            escapeCsvCell(row.id),
            escapeCsvCell(row.createdAt),
            escapeCsvCell(row.method),
            escapeCsvCell(row.totalAmount)
        ].join(','));
    });

    return lines.join('\n');
}

async function ensureOpenPeriod(prisma, userId = null) {
    const openPeriods = await prisma.cashClosePeriod.findMany({
        where: { status: PERIOD_STATUS.OPEN },
        orderBy: { startAt: 'asc' }
    });

    if (openPeriods.length === 1) {
        return openPeriods[0];
    }

    if (openPeriods.length === 0) {
        return prisma.cashClosePeriod.create({
            data: {
                status: PERIOD_STATUS.OPEN,
                periodType: 'MANUAL',
                startAt: new Date(),
                createdBy: userId || null
            }
        });
    }

    const [primary, ...duplicates] = openPeriods;
    const duplicateIds = duplicates.map((item) => item.id);
    if (duplicateIds.length > 0) {
        const now = new Date();
        await prisma.cashClosePeriod.updateMany({
            where: { id: { in: duplicateIds } },
            data: {
                status: PERIOD_STATUS.CLOSED,
                endAt: now,
                closedAt: now,
                closedBy: userId || null,
                notes: 'Auto-closed duplicate open period',
                snapshotJson: JSON.stringify({
                    reason: 'AUTO_CLOSED_DUPLICATE_OPEN_PERIOD'
                })
            }
        });
    }

    return primary;
}

async function resolveRangeFromQueryOrOpenPeriod(prisma, query, userId) {
    const { startAt, endAt } = query || {};
    if (startAt || endAt) {
        const parsed = parseRangeOrFallback(startAt, endAt);
        return { ...parsed, openPeriod: null };
    }

    const openPeriod = await ensureOpenPeriod(prisma, userId);
    return {
        start: openPeriod.startAt,
        end: new Date(),
        valid: true,
        openPeriod
    };
}

async function buildCloseSnapshot(prisma, start, end, stats, financialSnapshot) {
    const [payments, refunds, cashMovements, trainerPayouts, sales] = await Promise.all([
        prisma.payment.findMany({
            where: {
                paidAt: { gte: start, lte: end },
                status: { in: COMPLETED_PAYMENT_STATUSES }
            },
            select: {
                id: true,
                paidAt: true,
                amount: true,
                method: true,
                status: true,
                member: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: { paidAt: 'asc' }
        }),
        prisma.refund.findMany({
            where: { createdAt: { gte: start, lte: end } },
            include: {
                payment: { select: { method: true } }
            },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.cashMovement.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: {
                id: true,
                type: true,
                amount: true,
                reason: true,
                notes: true,
                createdAt: true
            },
            orderBy: { createdAt: 'asc' }
        }),
        prisma.trainerPayout.findMany({
            where: { paidAt: { gte: start, lte: end } },
            select: {
                id: true,
                totalAmount: true,
                method: true,
                note: true,
                paidAt: true
            },
            orderBy: { paidAt: 'asc' }
        }),
        prisma.saleTransaction.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: {
                id: true,
                createdAt: true,
                totalAmount: true,
                paymentMethod: true
            },
            orderBy: { createdAt: 'asc' }
        })
    ]);

    const paymentRows = payments.map((item) => ({
        id: item.id,
        paidAt: item.paidAt,
        method: String(item.method || 'cash').toLowerCase(),
        amount: toSafeNumber(item.amount),
        status: item.status,
        memberName: item.member ? `${item.member.firstName || ''} ${item.member.lastName || ''}`.trim() : null
    }));

    const paymentByMethod = paymentRows.reduce((acc, row) => {
        const key = row.method || 'cash';
        acc[key] = toSafeNumber(acc[key]) + toSafeNumber(row.amount);
        return acc;
    }, {});

    const refundRows = refunds.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        method: String(item.payment?.method || 'cash').toLowerCase(),
        amount: toSafeNumber(item.amount),
        reason: item.reason || null
    }));

    const cashInRows = cashMovements
        .filter((item) => String(item.type).toUpperCase() === 'IN')
        .map((item) => ({
            source: 'CASH_MOVEMENT',
            id: item.id,
            amount: toSafeNumber(item.amount),
            createdAt: item.createdAt,
            note: item.notes || item.reason || null
        }));

    const movementOutRows = cashMovements
        .filter((item) => String(item.type).toUpperCase() === 'OUT')
        .map((item) => ({
            source: 'CASH_MOVEMENT_OUT',
            id: item.id,
            method: 'cash',
            amount: toSafeNumber(item.amount),
            createdAt: item.createdAt,
            note: item.notes || item.reason || null
        }));

    const payoutRows = trainerPayouts.map((item) => ({
        source: 'TRAINER_PAYOUT',
        id: item.id,
        method: String(item.method || 'transfer').toLowerCase(),
        amount: toSafeNumber(item.totalAmount),
        createdAt: item.paidAt,
        note: item.note || null
    }));

    const salesRows = sales.map((item) => ({
        id: item.id,
        createdAt: item.createdAt,
        method: String(item.paymentMethod || 'cash').toLowerCase(),
        totalAmount: toSafeNumber(item.totalAmount)
    }));

    const salesByMethod = salesRows.reduce((acc, row) => {
        const key = row.method || 'cash';
        acc[key] = toSafeNumber(acc[key]) + toSafeNumber(row.totalAmount);
        return acc;
    }, {});

    return {
        version: CLOSE_EXPORT_VERSION,
        generatedAt: new Date().toISOString(),
        period: {
            startAt: start,
            endAt: end
        },
        totals: {
            expectedCashAmount: toSafeNumber(stats.expectedCashAmount),
            expectedNonCashAmount: toSafeNumber(stats.expectedNonCashAmount),
            expectedCardAmount: toSafeNumber(stats.expectedCardAmount),
            expectedTransferAmount: toSafeNumber(stats.expectedTransferAmount),
            expectedTotalAmount: toSafeNumber(stats.expectedTotalAmount),
            revenueTotal: toSafeNumber(financialSnapshot.totalRevenue),
            sessionsTotal: parseInt(financialSnapshot.totalSessions, 10) || 0,
            payoutsTotal: toSafeNumber(stats.payoutsTotal),
            cashInTotal: toSafeNumber(stats.cashInTotal),
            cashRefundsTotal: toSafeNumber(stats.cashRefundsTotal),
            cashRevenue: toSafeNumber(financialSnapshot.cashRevenue),
            cardRevenue: toSafeNumber(financialSnapshot.cardRevenue),
            transferRevenue: toSafeNumber(financialSnapshot.transferRevenue)
        },
        breakdown: {
            payments: {
                rows: paymentRows,
                summaryByMethod: paymentByMethod
            },
            refunds: {
                rows: refundRows
            },
            cashIn: {
                rows: cashInRows
            },
            payouts: {
                rows: [...movementOutRows, ...payoutRows]
            },
            sales: {
                rows: salesRows,
                summaryByMethod: salesByMethod
            },
            sessions: {
                totalSessions: parseInt(financialSnapshot.totalSessions, 10) || 0
            }
        }
    };
}

/**
 * GET /api/cash-closings/monthly-summary
 * Get monthly collection summary per employee (no closing required)
 * Accessible to all authenticated users
 */
router.get('/monthly-summary', async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM

        if (!month || !/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({
                success: false,
                message: 'Month parameter required (format: YYYY-MM)'
            });
        }

        // Parse month to get start and end dates
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date' });
        }

        // Get all completed payments in the month
        const payments = await req.prisma.payment.findMany({
            where: {
                paidAt: {
                    gte: startDate,
                    lte: endDate
                },
                status: { in: ['completed', 'refunded', 'partial_refund'] }
            },
            select: {
                id: true,
                amount: true,
                method: true,
                createdBy: true,
                creator: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        // Get all refunds in the month
        const refunds = await req.prisma.refund.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                payment: {
                    select: {
                        method: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        // Group by employee
        const employeeMap = new Map();
        let grandTotalPayments = 0;
        let grandTotalCash = 0;
        let grandTotalNonCash = 0;
        let grandTotalRefunds = 0;

        payments.forEach(payment => {
            const employeeId = payment.createdBy;
            if (!employeeId) return; // Skip payments with no employee

            const employeeName = payment.creator
                ? `${payment.creator.firstName} ${payment.creator.lastName}`
                : 'Unknown';

            if (!employeeMap.has(employeeId)) {
                employeeMap.set(employeeId, {
                    employeeId,
                    employeeName,
                    paymentsCount: 0,
                    cashTotal: 0,
                    nonCashTotal: 0,
                    total: 0,
                    refundsTotal: 0
                });
            }

            const employee = employeeMap.get(employeeId);
            employee.paymentsCount++;

            if (payment.method === 'cash') {
                employee.cashTotal += payment.amount;
            } else {
                employee.nonCashTotal += payment.amount;
            }
            employee.total += payment.amount;

            // Update grand totals
            grandTotalPayments++;
            if (payment.method === 'cash') {
                grandTotalCash += payment.amount;
            } else {
                grandTotalNonCash += payment.amount;
            }
        });

        // Process Refunds (Subtract from Grand Total, and maybe track by admin who did the refund?)
        // The user wants 'Total Refunds' as a distinct line item in the summary.
        // It's cleaner to just show Total Refunds globally for the month, 
        // but if we want to attribute it to an employee (who processed the refund), we can.
        // For 'Net Revenue = Total Sales - Total Refunds', this is usually a global figure.

        refunds.forEach(refund => {
            grandTotalRefunds += refund.amount;

            // Optional: Attribute refund to the admin who performed it?
            // If we want to show "Net Collection" per employee, we subtract logic.
            // But usually refunds are separate. We'll track it globally primarily, 
            // but also add to the map if the user exists in the map (or create new entry for admin).

            const adminId = refund.createdBy;
            if (adminId && employeeMap.has(adminId)) {
                employeeMap.get(adminId).refundsTotal += refund.amount;
            } else if (adminId) {
                // If admin didn't take any payments but did refunds, add them?
                const adminName = refund.user
                    ? `${refund.user.firstName} ${refund.user.lastName}`
                    : 'Unknown';

                employeeMap.set(adminId, {
                    employeeId: adminId,
                    employeeName: adminName,
                    paymentsCount: 0,
                    cashTotal: 0,
                    nonCashTotal: 0,
                    total: 0,
                    refundsTotal: refund.amount
                });
            }
        });

        // Convert map to array and sort by total DESC
        const employees = Array.from(employeeMap.values())
            .sort((a, b) => b.total - a.total);

        // Use Unified Financial Logic for Grand Total
        const netStats = await calculateNetRevenue(req.prisma, startDate, endDate);

        res.json({
            success: true,
            data: {
                month,
                employees,
                grandTotal: {
                    paymentsCount: netStats.paymentCount,
                    cashTotal: grandTotalCash, // Keep manual sum for cash breakdown if needed, or rely on service if expanded
                    nonCashTotal: grandTotalNonCash,
                    grossTotal: netStats.grossRevenue,
                    refundsTotal: netStats.totalRefunds,
                    netRevenue: netStats.netRevenue
                }
            }
        });

    } catch (error) {
        console.error('Monthly summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate monthly summary'
        });
    }
});

/**
 * GET /api/cash-closings/employee-payments
 * Get individual payment details for an employee in a date range
 * Accessible to all authenticated users
 */
router.get('/employee-payments', async (req, res) => {
    try {
        const { employeeId, startDate, endDate } = req.query;

        if (!employeeId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'employeeId, startDate, and endDate are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }

        const payments = await req.prisma.payment.findMany({
            where: {
                createdBy: parseInt(employeeId),
                paidAt: {
                    gte: start,
                    lte: end
                },
                status: 'completed'
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                paidAt: 'desc'
            }
        });

        res.json({
            success: true,
            data: payments
        });

    } catch (error) {
        console.error('Employee payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch employee payments'
        });
    }
});

/**
 * GET /api/cash-closings/period/current
 * Returns active OPEN period and preview snapshot for now
 */
router.get('/period/current', async (req, res) => {
    try {
        const openPeriod = await ensureOpenPeriod(req.prisma, req.user?.id || null);
        const start = openPeriod.startAt;
        const end = new Date();

        const [stats, snapshot] = await Promise.all([
            calculateCashClosingStats(req.prisma, start, end),
            calculateFinancialSnapshot(req.prisma, start, end)
        ]);

        const summary = normalizeFinancialPreviewSummary(snapshot);
        return res.json({
            success: true,
            data: {
                openPeriod: {
                    id: openPeriod.id,
                    periodType: openPeriod.periodType,
                    status: openPeriod.status,
                    startAt: openPeriod.startAt
                },
                range: {
                    startAt: start,
                    endAt: end
                },
                expected: stats,
                summary
            }
        });
    } catch (error) {
        console.error('[CashClosing][period/current] Failed to load current period preview');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        return res.json({
            success: true,
            data: {
                openPeriod: null,
                range: {
                    startAt: null,
                    endAt: null
                },
                expected: buildZeroExpectedStats(),
                summary: buildZeroFinancialPreviewSummary()
            }
        });
    }
});

/**
 * GET /api/cash-closings/calculate-expected
 * Preview expected amounts for selected range or current OPEN period
 */
router.get('/calculate-expected', async (req, res) => {
    try {
        const range = await resolveRangeFromQueryOrOpenPeriod(req.prisma, req.query, req.user?.id || null);
        if (!range.valid) {
            return res.json({
                success: true,
                data: buildZeroExpectedStats()
            });
        }

        const stats = await calculateCashClosingStats(req.prisma, range.start, range.end);
        return res.json({
            success: true,
            data: {
                ...stats,
                periodStartAt: range.start,
                periodEndAt: range.end,
                openPeriodId: range.openPeriod?.id || null
            }
        });
    } catch (error) {
        console.error('[CashClosing][calculate-expected] Failed to calculate expected amounts');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        return res.json({
            success: true,
            data: buildZeroExpectedStats()
        });
    }
});

/**
 * GET /api/cash-closings/sales-preview
 * Product sales summary for selected range or current OPEN period
 */
router.get('/sales-preview', async (req, res) => {
    try {
        const range = await resolveRangeFromQueryOrOpenPeriod(req.prisma, req.query, req.user?.id || null);
        if (!range.valid) {
            return res.json({
                success: true,
                data: {
                    totalRevenue: 0,
                    totalUnits: 0,
                    transactionsCount: 0,
                    topProducts: []
                }
            });
        }

        const where = {
            transaction: {
                createdAt: {
                    gte: range.start,
                    lte: range.end
                }
            }
        };

        const items = await req.prisma.saleItem.findMany({
            where,
            include: {
                product: { select: { id: true, name: true } },
                transaction: { select: { id: true } }
            }
        });

        const summary = {
            totalRevenue: 0,
            totalUnits: 0,
            transactionsCount: new Set()
        };

        const productMap = new Map();
        items.forEach((item) => {
            const revenue = Number(item.lineTotal) || 0;
            const qty = Number(item.quantity) || 0;
            summary.totalRevenue += revenue;
            summary.totalUnits += qty;
            if (item.transaction?.id) summary.transactionsCount.add(item.transaction.id);

            const productId = item.product?.id || item.productId;
            if (!productMap.has(productId)) {
                productMap.set(productId, {
                    productId,
                    name: item.product?.name || 'Unknown',
                    quantity: 0,
                    revenue: 0
                });
            }

            const entry = productMap.get(productId);
            entry.quantity += qty;
            entry.revenue += revenue;
        });

        const topProducts = Array.from(productMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return res.json({
            success: true,
            data: {
                totalRevenue: toSafeNumber(summary.totalRevenue),
                totalUnits: toSafeNumber(summary.totalUnits),
                transactionsCount: summary.transactionsCount.size,
                topProducts,
                periodStartAt: range.start,
                periodEndAt: range.end
            }
        });
    } catch (error) {
        console.error('[CashClosing][sales-preview] Failed to fetch sales preview');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        return res.json({
            success: true,
            data: {
                totalRevenue: 0,
                totalUnits: 0,
                transactionsCount: 0,
                topProducts: []
            }
        });
    }
});

/**
 * GET /api/cash-closings/financial-preview
 * Financial Snapshot Preview using selected range or current OPEN period
 */
router.get('/financial-preview', async (req, res) => {
    try {
        const range = await resolveRangeFromQueryOrOpenPeriod(req.prisma, req.query, req.user?.id || null);
        if (!range.valid) {
            const summary = buildZeroFinancialPreviewSummary();
            return res.json({ success: true, summary, data: summary });
        }

        const snapshot = await calculateFinancialSnapshot(req.prisma, range.start, range.end);
        const summary = normalizeFinancialPreviewSummary(snapshot);
        return res.json({
            success: true,
            summary,
            data: summary,
            range: {
                startAt: range.start,
                endAt: range.end
            },
            openPeriod: range.openPeriod
                ? {
                    id: range.openPeriod.id,
                    periodType: range.openPeriod.periodType,
                    status: range.openPeriod.status,
                    startAt: range.openPeriod.startAt
                }
                : null
        });
    } catch (error) {
        console.error('[CashClosing][financial-preview] Failed to calculate financial preview');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        const summary = buildZeroFinancialPreviewSummary();
        return res.json({ success: true, summary, data: summary });
    }
});

/**
 * POST /api/cash-closings
 * POS-style close current OPEN period, save immutable snapshot, then open new period
 */
router.post('/', [
    body('periodType').optional().isString(),
    body('endAt').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('declaredCashAmount').isFloat({ min: 0 }),
    body('declaredNonCashAmount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
    body('notes').optional({ nullable: true }).isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const periodType = normalizePeriodType(req.body.periodType);
        const declaredCashAmount = toSafeNumber(req.body.declaredCashAmount);
        const declaredNonCashAmount = toSafeNumber(req.body.declaredNonCashAmount);
        const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : null;
        const requestedEndAt = req.body.endAt ? new Date(req.body.endAt) : new Date();

        if (Number.isNaN(requestedEndAt.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid endAt date format'
            });
        }

        const closeResult = await req.prisma.$transaction(async (tx) => {
            const openPeriod = await ensureOpenPeriod(tx, req.user?.id || null);
            const periodStartAt = openPeriod.startAt;
            const periodEndAt = requestedEndAt;

            if (periodEndAt < periodStartAt) {
                const rangeError = new Error('CLOSE_END_BEFORE_PERIOD_START');
                rangeError.code = 'CLOSE_END_BEFORE_PERIOD_START';
                throw rangeError;
            }

            const [stats, financialSnapshot] = await Promise.all([
                calculateCashClosingStats(tx, periodStartAt, periodEndAt),
                calculateFinancialSnapshot(tx, periodStartAt, periodEndAt)
            ]);

            const expectedCashAmount = toSafeNumber(stats.expectedCashAmount);
            const expectedNonCashAmount = toSafeNumber(stats.expectedNonCashAmount);
            const expectedTotalAmount = toSafeNumber(stats.expectedTotalAmount);
            const actualTotalAmount = toSafeNumber(declaredCashAmount + declaredNonCashAmount);
            const differenceCash = toSafeNumber(declaredCashAmount - expectedCashAmount);
            const differenceNonCash = toSafeNumber(declaredNonCashAmount - expectedNonCashAmount);
            const differenceTotal = toSafeNumber(actualTotalAmount - expectedTotalAmount);

            const snapshot = await buildCloseSnapshot(tx, periodStartAt, periodEndAt, stats, financialSnapshot);
            const closedAt = new Date();

            const closedPeriod = await tx.cashClosePeriod.update({
                where: { id: openPeriod.id },
                data: {
                    periodType,
                    status: PERIOD_STATUS.CLOSED,
                    endAt: periodEndAt,
                    closedAt,
                    closedBy: req.user?.id || null,
                    notes: notes || null,
                    snapshotJson: JSON.stringify(snapshot),
                    exportVersion: CLOSE_EXPORT_VERSION,
                    expectedCashAmount,
                    expectedNonCashAmount,
                    expectedCardAmount: toSafeNumber(stats.expectedCardAmount),
                    expectedTransferAmount: toSafeNumber(stats.expectedTransferAmount),
                    expectedTotalAmount,
                    actualCashAmount: declaredCashAmount,
                    actualNonCashAmount: declaredNonCashAmount,
                    actualTotalAmount,
                    differenceCash,
                    differenceNonCash,
                    differenceTotal,
                    revenueTotal: toSafeNumber(financialSnapshot.totalRevenue),
                    sessionsTotal: parseInt(financialSnapshot.totalSessions, 10) || 0,
                    payoutsTotal: toSafeNumber(stats.payoutsTotal),
                    cashInTotal: toSafeNumber(stats.cashInTotal),
                    cashRefundsTotal: toSafeNumber(stats.cashRefundsTotal),
                    cashRevenue: toSafeNumber(financialSnapshot.cashRevenue),
                    cardRevenue: toSafeNumber(financialSnapshot.cardRevenue),
                    transferRevenue: toSafeNumber(financialSnapshot.transferRevenue)
                },
                include: {
                    createdByUser: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    closedByUser: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            });

            const nextPeriodStartAt = new Date(periodEndAt.getTime() + 1000);
            const newOpenPeriod = await tx.cashClosePeriod.create({
                data: {
                    periodType: 'MANUAL',
                    status: PERIOD_STATUS.OPEN,
                    startAt: nextPeriodStartAt,
                    createdBy: req.user?.id || null
                }
            });

            return { closedPeriod, newOpenPeriod };
        });

        await createAuditLog(
            req.prisma,
            'CASH_CLOSE_PERIOD_CLOSED',
            'CashClosePeriod',
            closeResult.closedPeriod.id,
            req.user?.id,
            {
                closeId: closeResult.closedPeriod.id,
                startAt: closeResult.closedPeriod.startAt,
                endAt: closeResult.closedPeriod.endAt,
                expectedCashAmount: closeResult.closedPeriod.expectedCashAmount,
                actualCashAmount: closeResult.closedPeriod.actualCashAmount
            }
        );

        return res.status(201).json({
            success: true,
            data: {
                closeId: closeResult.closedPeriod.id,
                exportAvailable: true,
                exportFormats: ['csv', 'json'],
                exportUrl: `/api/cash-closings/${closeResult.closedPeriod.id}/export?format=json`,
                closedPeriod: normalizePeriodRow(closeResult.closedPeriod),
                newOpenPeriod: {
                    id: closeResult.newOpenPeriod.id,
                    startAt: closeResult.newOpenPeriod.startAt,
                    periodType: closeResult.newOpenPeriod.periodType,
                    status: closeResult.newOpenPeriod.status
                }
            }
        });
    } catch (error) {
        if (error?.code === 'CLOSE_END_BEFORE_PERIOD_START' || error?.message === 'CLOSE_END_BEFORE_PERIOD_START') {
            return res.status(400).json({
                success: false,
                message: 'Close end time cannot be before current open period start time'
            });
        }

        console.error('[CashClosing][create] Failed to create close period');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to create cash close period'
        });
    }
});

// ============================================
// ADMIN ONLY ROUTES
// ============================================
router.use(authorize('admin'));

function buildPeriodsSummary(rows = []) {
    return rows.reduce((acc, row) => {
        acc.totalExpectedCash += toSafeNumber(row.expectedCashAmount);
        acc.totalExpectedNonCash += toSafeNumber(row.expectedNonCashAmount);
        acc.totalExpected += toSafeNumber(row.expectedTotalAmount);
        acc.totalDeclaredCash += toSafeNumber(row.declaredCashAmount);
        acc.totalDeclaredNonCash += toSafeNumber(row.declaredNonCashAmount);
        acc.totalDeclared += toSafeNumber(row.declaredTotalAmount);
        acc.totalDifferenceCash += toSafeNumber(row.differenceCash);
        acc.totalDifferenceNonCash += toSafeNumber(row.differenceNonCash);
        acc.totalDifference += toSafeNumber(row.differenceTotal);
        return acc;
    }, {
        totalExpectedCash: 0,
        totalExpectedNonCash: 0,
        totalExpected: 0,
        totalDeclaredCash: 0,
        totalDeclaredNonCash: 0,
        totalDeclared: 0,
        totalDifferenceCash: 0,
        totalDifferenceNonCash: 0,
        totalDifference: 0
    });
}

function parseDateOrNull(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * GET /api/cash-closings/history
 * List CLOSED cash close periods (history)
 */
router.get('/history', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            periodType,
            startDate,
            endDate
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
        const skip = (pageNumber - 1) * limitNumber;

        const where = {
            status: PERIOD_STATUS.CLOSED
        };

        if (periodType) {
            where.periodType = normalizePeriodType(periodType);
        }

        const parsedStartDate = parseDateOrNull(startDate);
        const parsedEndDate = parseDateOrNull(endDate);
        if (parsedStartDate || parsedEndDate) {
            where.closedAt = {};
            if (parsedStartDate) where.closedAt.gte = parsedStartDate;
            if (parsedEndDate) where.closedAt.lte = parsedEndDate;
        }

        const [periods, total] = await Promise.all([
            req.prisma.cashClosePeriod.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: { closedAt: 'desc' },
                include: {
                    createdByUser: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    closedByUser: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }),
            req.prisma.cashClosePeriod.count({ where })
        ]);

        const closings = periods.map(normalizePeriodRow);
        const summary = buildPeriodsSummary(closings);

        res.json({
            success: true,
            data: {
                closings,
                rows: closings,
                summary,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages: Math.ceil(total / limitNumber)
                }
            }
        });

    } catch (error) {
        console.error('[CashClosing][history] Failed to fetch close history');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        res.status(500).json({
            success: false,
            message: 'Failed to fetch close history'
        });
    }
});

/**
 * GET /api/cash-closings
 * Backward-compatible list endpoint (defaults to CLOSED periods)
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            periodType,
            status,
            startDate,
            endDate
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
        const skip = (pageNumber - 1) * limitNumber;

        const statusFilter = String(status || PERIOD_STATUS.CLOSED).trim().toUpperCase();
        const where = {};
        if (statusFilter === PERIOD_STATUS.OPEN || statusFilter === PERIOD_STATUS.CLOSED) {
            where.status = statusFilter;
        }

        if (periodType) {
            where.periodType = normalizePeriodType(periodType);
        }

        const parsedStartDate = parseDateOrNull(startDate);
        const parsedEndDate = parseDateOrNull(endDate);
        if (parsedStartDate || parsedEndDate) {
            const dateField = where.status === PERIOD_STATUS.OPEN ? 'startAt' : 'closedAt';
            where[dateField] = {};
            if (parsedStartDate) where[dateField].gte = parsedStartDate;
            if (parsedEndDate) where[dateField].lte = parsedEndDate;
        }

        const [periods, total] = await Promise.all([
            req.prisma.cashClosePeriod.findMany({
                where,
                skip,
                take: limitNumber,
                orderBy: where.status === PERIOD_STATUS.OPEN ? { startAt: 'desc' } : { closedAt: 'desc' },
                include: {
                    createdByUser: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    closedByUser: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }),
            req.prisma.cashClosePeriod.count({ where })
        ]);

        const closings = periods.map(normalizePeriodRow);
        const summary = buildPeriodsSummary(closings);

        res.json({
            success: true,
            data: {
                closings,
                rows: closings,
                summary,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages: Math.ceil(total / limitNumber)
                }
            }
        });
    } catch (error) {
        console.error('[CashClosing][list] Failed to fetch cash close periods');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cash close periods'
        });
    }
});

/**
 * GET /api/cash-closings/:id/export?format=csv|json
 * Export closed period from immutable snapshot payload
 */
router.get('/:id/export', async (req, res) => {
    try {
        const periodId = parseInt(req.params.id, 10);
        if (!Number.isFinite(periodId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid close id'
            });
        }

        const format = String(req.query.format || 'json').trim().toLowerCase();
        if (!['csv', 'json'].includes(format)) {
            return res.status(400).json({
                success: false,
                message: 'Unsupported format. Use csv or json'
            });
        }

        const period = await req.prisma.cashClosePeriod.findUnique({
            where: { id: periodId },
            include: {
                createdByUser: {
                    select: { id: true, firstName: true, lastName: true }
                },
                closedByUser: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        });

        if (!period || period.status !== PERIOD_STATUS.CLOSED) {
            return res.status(404).json({
                success: false,
                message: 'Closed cash period not found'
            });
        }

        const payload = buildExportPayload(period);
        if (format === 'csv') {
            const csv = buildExportCsv(payload);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="cash-close-${periodId}.csv"`);
            return res.send(csv);
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="cash-close-${periodId}.json"`);
        return res.send(JSON.stringify(payload, null, 2));
    } catch (error) {
        console.error('[CashClosing][export] Failed to export close period');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to export close period'
        });
    }
});

/**
 * GET /api/cash-closings/:id
 * Get cash close period details (new model) with legacy fallback
 */
router.get('/:id', async (req, res) => {
    try {
        const closeId = parseInt(req.params.id, 10);
        if (!Number.isFinite(closeId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid close id'
            });
        }

        const period = await req.prisma.cashClosePeriod.findUnique({
            where: { id: closeId },
            include: {
                createdByUser: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                closedByUser: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                }
            }
        });

        if (period) {
            const normalized = normalizePeriodRow(period);
            const exportPayload = buildExportPayload(period);
            return res.json({
                success: true,
                data: {
                    ...normalized,
                    period: normalized,
                    totals: exportPayload.totals || {},
                    breakdown: exportPayload.breakdown || {},
                    meta: exportPayload.meta || {}
                }
            });
        }

        const closing = await req.prisma.cashClosing.findUnique({
            where: { id: closeId },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                },
                adjustments: {
                    include: {
                        creator: {
                            select: { id: true, firstName: true, lastName: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!closing) {
            return res.status(404).json({
                success: false,
                message: 'Cash close record not found'
            });
        }

        let adjustmentTotal = 0;
        closing.adjustments.forEach((adj) => {
            if (adj.type === 'ADD') adjustmentTotal += adj.amount;
            else adjustmentTotal -= adj.amount;
        });

        // We return the raw closing data + computed final
        const responseData = {
            ...closing,
            computed: {
                adjustmentTotal,
                finalCashBalance: closing.declaredCashAmount + adjustmentTotal
            }
        };

        res.json({
            success: true,
            data: responseData
        });

    } catch (error) {
        console.error('[CashClosing][detail] Failed to fetch cash close detail');
        if (process.env.NODE_ENV !== 'production') {
            console.error(error?.stack || error);
        }
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cash closing'
        });
    }
});

/**
 * POST /api/cash-closings/:id/adjustments
 * Add an adjustment to a CLOSED closing
 * Admin Only
 */
router.post('/:id/adjustments', authorize('admin'), [
    body('type').isIn(['ADD', 'SUBTRACT']),
    body('amount').isFloat({ min: 0.01 }),
    body('reason').isString().notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

        const closingId = parseInt(req.params.id);
        const { type, amount, reason } = req.body;

        // Verify closing exists
        const closing = await req.prisma.cashClosing.findUnique({ where: { id: closingId } });
        if (!closing) return res.status(404).json({ success: false, message: 'Closing not found' });

        const adjustment = await req.prisma.cashClosingAdjustment.create({
            data: {
                closingId,
                type,
                amount,
                reason,
                createdBy: req.user.id
            },
            include: {
                creator: { select: { firstName: true, lastName: true } }
            }
        });

        await createAuditLog(req.prisma, 'CASH_CLOSING_ADJUSTMENT', 'CashClosingAdjustment', adjustment.id, req.user.id, {
            closingId, type, amount
        });

        res.json({
            success: true,
            data: adjustment
        });

    } catch (error) {
        console.error('Add adjustment error:', error);
        res.status(500).json({ success: false, message: 'Failed to add adjustment' });
    }
});

module.exports = router;
