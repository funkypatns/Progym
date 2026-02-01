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
 * GET /api/cash-closings/calculate-expected
 * Preview expected amounts for a period (does NOT create closing)
 * Accessible to all authenticated users
 */
router.get('/calculate-expected', async (req, res) => {
    try {
        const { startAt, endAt, employeeId } = req.query;

        console.log(`[CalculateExpected] Query: startAt=${startAt}, endAt=${endAt}, employeeId=${employeeId}`);

        if (!startAt || !endAt) {
            return res.status(400).json({
                success: false,
                message: 'Start and end dates are required'
            });
        }

        const start = new Date(startAt);
        const end = new Date(endAt);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }

        // Filter logic:
        // If Admin: can filter by employeeId (or 'all' for everyone).
        // If Staff: forced to their own ID.
        let targetEmpId = null;
        if (req.user.role !== 'admin') {
            targetEmpId = req.user.id;
        } else if (employeeId && employeeId !== 'all') {
            targetEmpId = employeeId;
        }

        const stats = await calculateCashClosingStats(req.prisma, start, end, targetEmpId);

        console.log(`[CalculateExpected] Result:`, stats);

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Calculate expected error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate expected amounts'
        });
    }
});

/**
 * GET /api/cash-closings/sales-preview
 * Quick product sales summary for the selected period
 * Accessible to all authenticated users
 */
router.get('/sales-preview', async (req, res) => {
    try {
        const { startAt, endAt, employeeId } = req.query;

        if (!startAt || !endAt) {
            return res.status(400).json({
                success: false,
                message: 'Start and end dates are required'
            });
        }

        let start = new Date(startAt);
        let end = new Date(endAt);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }
        if (start > end) {
            [start, end] = [end, start];
        }

        let targetEmpId = null;
        if (req.user.role !== 'admin') {
            targetEmpId = req.user.id;
        } else if (employeeId && employeeId !== 'all') {
            targetEmpId = parseInt(employeeId);
        }

        const where = {
            transaction: {
                createdAt: {
                    gte: start,
                    lte: end
                }
            }
        };

        if (targetEmpId) {
            where.transaction.employeeId = targetEmpId;
        }

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

        res.json({
            success: true,
            data: {
                totalRevenue: summary.totalRevenue,
                totalUnits: summary.totalUnits,
                transactionsCount: summary.transactionsCount.size,
                topProducts
            }
        });

    } catch (error) {
        console.error('Sales preview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch sales preview'
        });
    }
});

/**
 * GET /api/cash-closings/financial-preview
 * Financial Snapshot Preview (Strict Logic)
 * Accessible to all authenticated users
 */
router.get('/financial-preview', async (req, res) => {
    try {
        const { startAt, endAt } = req.query;

        if (!startAt || !endAt) {
            return res.status(400).json({ success: false, message: 'Start and end dates are required' });
        }

        const stats = await calculateFinancialSnapshot(req.prisma, new Date(startAt), new Date(endAt));

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Financial preview error:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate financial preview' });
    }
});

/**
 * POST /api/cash-closings
 * Create new cash closing (IMMUTABLE)
 * Accessible to all authenticated users
 */
router.post('/', [
    body('employeeId').optional().isInt(),
    body('periodType').isIn(['daily', 'monthly', 'custom', 'shift']),
    body('startAt').isISO8601(),
    body('endAt').isISO8601(),
    body('declaredCashAmount').isFloat({ min: 0 }),
    body('declaredNonCashAmount').isFloat({ min: 0 }),
    body('notes').optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const {
            employeeId,
            periodType,
            startAt,
            endAt,
            declaredCashAmount,
            declaredNonCashAmount,
            notes
        } = req.body;

        // PERMISSION CHECK:
        // If user is not admin, they can ONLY create closing for themselves
        let targetEmployeeId;

        if (req.user.role !== 'admin') {
            targetEmployeeId = req.user.id;

            // If they tried to submit for someone else, warn or just override
            if (employeeId && parseInt(employeeId) !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Staff/Trainers can only create cash closings for themselves'
                });
            }
        } else {
            // Admin can specify employeeId, or defaults to null (global closing? rare) or themselves
            targetEmployeeId = employeeId ? parseInt(employeeId) : null;
        }

        // Get employee name if valid ID
        let employeeName = null;
        if (targetEmployeeId) {
            const employee = await req.prisma.user.findUnique({
                where: { id: targetEmployeeId },
                select: { firstName: true, lastName: true }
            });
            if (employee) {
                employeeName = `${employee.firstName} ${employee.lastName}`;
            }
        }

        // Calculate expected amounts (SNAPSHOT)
        const stats = await calculateCashClosingStats(req.prisma, new Date(startAt), new Date(endAt), targetEmployeeId);

        // Calculate FINANCIAL SNAPSHOT (Strict)
        const financialSnapshot = await calculateFinancialSnapshot(req.prisma, new Date(startAt), new Date(endAt));

        const expectedCashAmount = stats.expectedCashAmount;
        const expectedNonCashAmount = stats.expectedNonCashAmount;
        const expectedTotalAmount = stats.expectedTotalAmount;

        // Calculate declared total
        const declaredTotalAmount = declaredCashAmount + declaredNonCashAmount;

        // Calculate differences
        const differenceCash = declaredCashAmount - expectedCashAmount;
        const differenceNonCash = declaredNonCashAmount - expectedNonCashAmount;
        const differenceTotal = declaredTotalAmount - expectedTotalAmount;

        // Determine status (STRICTLY CANCELLING GLOBAL TOTAL INFLUENCE RE USER REQ)
        // Status is based ONLY on the Cash difference.
        let status = 'balanced';
        if (differenceCash < -0.01) { // 0.01 tolerance for floats
            status = 'shortage';
        } else if (differenceCash > 0.01) {
            status = 'overage';
        }

        // Create closing record (IMMUTABLE)
        const closing = await req.prisma.cashClosing.create({
            data: {
                employeeId: targetEmployeeId,
                employeeName,
                periodType,
                startAt: new Date(startAt),
                endAt: new Date(endAt),
                expectedCashAmount,
                expectedNonCashAmount,
                expectedTotalAmount,
                declaredCashAmount,
                declaredNonCashAmount,
                declaredTotalAmount,
                differenceCash,
                differenceNonCash,
                differenceTotal,
                status,
                notes,
                createdBy: req.user.id,

                // Save Financial Snapshot
                totalSessions: financialSnapshot.totalSessions,
                grossRevenue: financialSnapshot.grossRevenue,
                totalCoachCommissions: financialSnapshot.totalCoachCommissions,
                gymNetIncome: financialSnapshot.gymNetIncome,
                breakdownByCoach: JSON.stringify(financialSnapshot.breakdownByCoach),
                breakdownByService: JSON.stringify(financialSnapshot.breakdownByService)
            },
            include: {
                employee: {
                    select: { id: true, firstName: true, lastName: true }
                },
                creator: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        });

        // Create audit log
        await createAuditLog(
            req.prisma,
            'CASH_CLOSING_CREATED',
            'CashClosing',
            closing.id,
            req.user.id,
            {
                periodType,
                status,
                differenceTotal
            }
        );

        res.status(201).json({
            success: true,
            data: closing
        });

    } catch (error) {
        console.error('Create cash closing error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create cash closing'
        });
    }
});

// ============================================
// ADMIN ONLY ROUTES
// ============================================
router.use(authorize('admin'));

/**
 * GET /api/cash-closings
 * List all cash closings with filters
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            employeeId,
            periodType,
            status,
            startDate,
            endDate
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (employeeId) where.employeeId = parseInt(employeeId);
        if (periodType) where.periodType = periodType;
        if (status) where.status = status;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const [closings, total] = await Promise.all([
            req.prisma.cashClosing.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    employee: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    creator: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            }),
            req.prisma.cashClosing.count({ where })
        ]);

        // Calculate summary totals
        const summary = closings.reduce((acc, closing) => {
            acc.totalExpectedCash += closing.expectedCashAmount;
            acc.totalExpectedNonCash += closing.expectedNonCashAmount;
            acc.totalExpected += closing.expectedTotalAmount;
            acc.totalDeclaredCash += closing.declaredCashAmount;
            acc.totalDeclaredNonCash += closing.declaredNonCashAmount;
            acc.totalDeclared += closing.declaredTotalAmount;
            acc.totalDifferenceCash += closing.differenceCash;
            acc.totalDifferenceNonCash += closing.differenceNonCash;
            acc.totalDifference += closing.differenceTotal;
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

        res.json({
            success: true,
            data: {
                closings,
                summary,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Get cash closings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch cash closings'
        });
    }
});

/**
 * GET /api/cash-closings/:id
 * Get single cash closing detail with adjustments
 */
router.get('/:id', async (req, res) => {
    try {
        const closing = await req.prisma.cashClosing.findUnique({
            where: { id: parseInt(req.params.id) },
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
                message: 'Cash closing not found'
            });
        }

        // Create audit log for viewing (optional, maybe too noisy?)
        // keeping it simple for now

        // Calculate Final Adjusted Net
        let finalCashNet = closing.differenceCash + closing.expectedCashAmount;
        // Or should it be Declared Cash + Adjustments? 
        // User REQ: FinalCashNet = cashNet + sum(adjustments signed)
        // cashNet usually means the result of the drawer Closing. 
        // If Closing was: Expected 100, Declared 90 (Diff -10).
        // Actual Cash in Hand was 90.
        // If we add adjustment +5. Final is 95.
        // So base is `declaredCashAmount`.

        let adjustmentTotal = 0;
        closing.adjustments.forEach(adj => {
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
        console.error('Get cash closing error:', error);
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
