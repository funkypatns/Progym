/**
 * ============================================
 * DASHBOARD ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
const { calculateNetRevenue } = require('../utils/financialCalculations');

router.get('/stats', async (req, res) => {
    try {
        if (!req.prisma) {
            throw new Error('Database connection not available');
        }

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Define default stats in case of failure
        const zeroStats = {
            grossRevenue: 0,
            totalRefunds: 0,
            netRevenue: 0,
            paymentCount: 0,
            refundCount: 0
        };

        // Calculate Revenue using Unified Service
        // Wrap in try-catch to prevent dashboard crash if financials fail
        let todayStats = zeroStats;
        let monthStats = zeroStats;

        try {
            [todayStats, monthStats] = await Promise.all([
                calculateNetRevenue(req.prisma, todayStart, now),
                calculateNetRevenue(req.prisma, monthStart, now)
            ]);
        } catch (finError) {
            console.error('[DASHBOARD] Financial calculation error:', finError);
            // Continue with zeroStats
        }

        const [
            totalMembers,
            activeMembers,
            newMembersThisMonth,
            activeSubscriptions,
            expiringSubscriptions,
            todayCheckIns,
        ] = await Promise.all([
            // Total members
            req.prisma.member.count(),

            // Active members (Have valid active subscription)
            req.prisma.member.count({
                where: {
                    isActive: true, // Account not deleted
                    subscriptions: {
                        some: {
                            status: 'active',
                            endDate: { gte: now }
                        }
                    }
                }
            }),

            // New members this month
            req.prisma.member.count({
                where: { createdAt: { gte: monthStart } }
            }),

            // Active subscriptions
            req.prisma.subscription.count({
                where: {
                    status: 'active',
                    endDate: { gte: now }
                }
            }),

            // Subscriptions expiring in 7 days
            req.prisma.subscription.count({
                where: {
                    status: 'active',
                    endDate: {
                        gte: now,
                        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                    }
                }
            }),

            // Today's check-ins
            req.prisma.checkIn.count({
                where: { checkInTime: { gte: todayStart } }
            })
        ]);

        // Get expired subscriptions count
        const expiredSubscriptions = await req.prisma.subscription.count({
            where: {
                status: 'active',
                endDate: { lt: now }
            }
        });

        // Get inactive members count
        const inactiveMembersCount = totalMembers - activeMembers;

        res.json({
            success: true,
            data: {
                members: {
                    total: totalMembers,
                    active: activeMembers,
                    newThisMonth: newMembersThisMonth,
                    inactive: inactiveMembersCount
                },
                subscriptions: {
                    active: activeSubscriptions,
                    expiring: expiringSubscriptions,
                    expired: expiredSubscriptions
                },
                checkIns: {
                    today: todayCheckIns
                },
                revenue: (req.user.role === 'admin') ? {
                    today: todayStats.netRevenue || 0,
                    thisMonth: monthStats.netRevenue || 0,
                    todayGross: todayStats.grossRevenue || 0,
                    todayRefunds: todayStats.totalRefunds || 0,
                    monthlyGross: monthStats.grossRevenue || 0,
                    monthlyRefunds: monthStats.totalRefunds || 0
                } : await (async () => {
                    // Staff View: Show CURRENT SHIFT revenue only
                    try {
                        const posService = require('../services/posService');
                        const openShift = await posService.getOpenShiftForUser(req.user.id);

                        if (openShift) {
                            const summary = await posService.getShiftSummary(openShift.id);
                            return {
                                today: summary.netCash || 0,
                                thisMonth: summary.expectedCash || 0, // Label reuse: "This Month" card usually shows main total
                                todayGross: summary.totalCollected || 0,
                                todayRefunds: summary.totalRefunded || 0,
                                monthlyGross: 0, // Not applicable for shift
                                monthlyRefunds: 0
                            };
                        }
                    } catch (e) {
                        console.error('Failed to load shift stats for dashboard:', e);
                    }

                    return {
                        today: 0,
                        thisMonth: 0,
                        todayGross: 0,
                        todayRefunds: 0,
                        monthlyGross: 0,
                        monthlyRefunds: 0
                    };
                })()
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error_code: 'DASHBOARD_STATS_ERROR'
        });
    }
});

/**
 * GET /api/dashboard/chart/revenue
 * Get revenue chart data
 */
router.get('/chart/revenue', authenticate, requirePermission('dashboard.view_financials'), async (req, res) => {
    try {
        // RBAC: Revenue chart is Admin Only
        if (req.user.role !== 'admin') {
            return res.json({ success: true, data: [] });
        }

        const { period = 'month' } = req.query;
        // VALIDATION: Ensure period is valid
        const validPeriods = ['week', 'month', 'year'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`
            });
        }

        const now = new Date();
        let startDate;
        let groupBy;

        if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            groupBy = 'day';
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            groupBy = 'day';
        } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            groupBy = 'month';
        }

        const payments = await req.prisma.payment.findMany({
            where: {
                status: 'completed',
                paidAt: { gte: startDate }
            },
            select: {
                amount: true,
                paidAt: true
            },
            orderBy: { paidAt: 'asc' }
        });

        // Group by date
        const grouped = {};
        payments.forEach(p => {
            if (!p.paidAt) return; // Safety check
            const date = new Date(p.paidAt);
            let key;

            if (groupBy === 'day') {
                try {
                    key = date.toISOString().split('T')[0];
                } catch (e) { key = 'Invalid Date'; }
            } else {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (key !== 'Invalid Date') {
                if (!grouped[key]) {
                    grouped[key] = 0;
                }
                grouped[key] += (p.amount || 0);
            }
        });

        const chartData = Object.entries(grouped).map(([date, amount]) => ({
            date,
            amount: parseFloat(amount.toFixed(2)) // Ensure clean float
        }));

        res.json({
            success: true,
            data: chartData
        });

    } catch (error) {
        console.error('Get revenue chart error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue chart data',
            error_code: 'REVENUE_CHART_ERROR'
        });
    }
});

/**
 * GET /api/dashboard/chart/checkins
 * Get check-ins chart data
 */
router.get('/chart/checkins', requirePermission('checkins.view'), async (req, res) => {
    try {
        let { days = 7 } = req.query;

        // VALIDATION: Ensure days is a number
        days = parseInt(days);
        if (isNaN(days) || days < 1 || days > 365) {
            days = 7; // Default fallback
        }

        let startDate = new Date();

        // RBAC: Shift Logic
        if (req.user.role !== 'admin') {
            // Staff: Current shift only
            try {
                const posService = require('../services/posService');
                const activeShift = await posService.getOpenShiftForUser(req.user.id);

                if (!activeShift) {
                    return res.json({ success: true, data: [] });
                }
                startDate = new Date(activeShift.openedAt);
            } catch (shiftError) {
                console.error('Shift check error in checkins chart:', shiftError);
                return res.json({ success: true, data: [] }); // Fail safe empty chart
            }
        } else {
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
        }

        const checkIns = await req.prisma.checkIn.findMany({
            where: {
                checkInTime: { gte: startDate }
            },
            select: {
                checkInTime: true
            }
        });

        // Group by date
        const grouped = {};
        checkIns.forEach(c => {
            if (!c.checkInTime) return;
            try {
                const date = new Date(c.checkInTime).toISOString().split('T')[0];
                grouped[date] = (grouped[date] || 0) + 1;
            } catch (e) {
                // Ignore invalid dates
            }
        });

        const chartData = Object.entries(grouped).map(([date, count]) => ({
            date,
            count
        }));

        res.json({
            success: true,
            data: chartData
        });

    } catch (error) {
        console.error('Get check-ins chart error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch check-ins chart data',
            error_code: 'CHECKIN_CHART_ERROR'
        });
    }
});

/**
 * GET /api/dashboard/recent
 * Get recent activities
 */
router.get('/recent', async (req, res) => {
    try {
        // RBAC: Staff can ONLY see recent activities for their current open shift
        const paymentWhere = {};
        const checkInWhere = {};

        if (req.user.role !== 'admin') {
            const posService = require('../services/posService');
            const openShift = await posService.getOpenShiftForUser(req.user.id);

            if (!openShift) {
                return res.json({
                    success: true,
                    data: {
                        members: [],
                        payments: [],
                        checkIns: []
                    }
                });
            }

            // Filter payments by shift
            paymentWhere.shiftId = openShift.id;

            // Filter check-ins by time (since shift open)
            checkInWhere.checkInTime = { gte: openShift.openedAt };
        }

        const [recentMembers, recentPayments, recentCheckIns] = await Promise.all([
            // Members are global (okay to see who joined recently? Maybe restring to admin?)
            // Usually seeing new members is fine, but let's stick to strict isolation or leave global if low risk.
            // User requirement: "Member management... view allowed". Staff can view members.
            // So global recent members is acceptable.
            req.prisma.member.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    memberId: true,
                    firstName: true,
                    lastName: true,
                    photo: true,
                    createdAt: true
                }
            }),

            req.prisma.payment.findMany({
                where: paymentWhere,
                take: 5,
                orderBy: { paidAt: 'desc' },
                include: {
                    member: {
                        select: { firstName: true, lastName: true }
                    }
                }
            }),

            req.prisma.checkIn.findMany({
                where: checkInWhere,
                take: 5,
                orderBy: { checkInTime: 'desc' },
                include: {
                    member: {
                        select: { firstName: true, lastName: true, photo: true }
                    }
                }
            })
        ]);

        res.json({
            success: true,
            data: {
                members: recentMembers,
                payments: recentPayments,
                checkIns: recentCheckIns
            }
        });

    } catch (error) {
        console.error('Get recent activities error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent activities'
        });
    }
});

/**
 * GET /api/dashboard/financials
 * Get financial KPI summary for dashboard
 */
router.get('/financials', authenticate, requirePermission('dashboard.view_financials'), async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (req.user.role !== 'admin') {
            return res.json({ success: true, data: null });
        }

        const { period = 'month' } = req.query;
        // VALIDATION: Ensure period is valid
        const validPeriods = ['week', 'month', 'year'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
                requestId
            });
        }

        const now = new Date();
        let startDate;

        if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        // Get payments
        const payments = await req.prisma.payment.findMany({
            where: {
                status: 'completed',
                paidAt: { gte: startDate, lte: now }
            },
            select: { amount: true, method: true }
        });

        // Get refunds
        const refunds = await req.prisma.refund.findMany({
            where: {
                createdAt: { gte: startDate, lte: now }
            },
            select: { amount: true }
        });

        const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalRefunded = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
        const net = totalCollected - totalRefunded;

        let refundRate = 0;
        if (totalCollected > 0) {
            refundRate = parseFloat(((totalRefunded / totalCollected) * 100).toFixed(1));
        }

        // By method
        const byMethod = { cash: 0, card: 0, transfer: 0 };
        payments.forEach(p => {
            const m = (p.method || 'cash').toLowerCase();
            const amt = p.amount || 0;
            if (m === 'cash' || m === 'manual' || m === 'نقدي') byMethod.cash += amt;
            else if (m === 'card' || m === 'visa' || m === 'بطاقة') byMethod.card += amt;
            else if (m === 'transfer' || m.includes('vodafone') || m.includes('instapay') || m.includes('تحويل')) byMethod.transfer += amt;
            else byMethod.cash += amt; // Fallback
        });

        res.json({
            success: true,
            data: {
                totalCollected,
                totalRefunded,
                net,
                refundRate,
                byMethod,
                refundCount: refunds.length || 0,
                paymentCount: payments.length || 0
            }
        });
    } catch (error) {
        console.error(`[Dashboard Financials Error] [${requestId}]`, error);
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch financials',
            code: 'DASHBOARD_FINANCIALS_ERROR',
            requestId
        });
    }
});

/**
 * GET /api/dashboard/chart/collections
 * Get collections chart data (stacked by payment method)
 */
router.get('/chart/collections', authenticate, requirePermission('dashboard.view_financials'), async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (req.user.role !== 'admin') {
            return res.json({ success: true, data: [] });
        }

        const { period = 'month' } = req.query;
        // VALIDATION
        const validPeriods = ['week', 'month', 'year'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
                requestId
            });
        }

        const now = new Date();
        let startDate;

        if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        const payments = await req.prisma.payment.findMany({
            where: {
                status: 'completed',
                paidAt: { gte: startDate, lte: now }
            },
            select: { amount: true, method: true, paidAt: true }
        });

        // Group by date and method
        const grouped = {};
        payments.forEach(p => {
            if (!p.paidAt) return;
            try {
                const date = new Date(p.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (!grouped[date]) {
                    grouped[date] = { date, cash: 0, card: 0, transfer: 0, total: 0 };
                }
                const m = (p.method || 'cash').toLowerCase();
                const amount = p.amount || 0;

                grouped[date].total += amount;

                if (m === 'cash' || m === 'manual' || m === 'نقدي') grouped[date].cash += amount;
                else if (m === 'card' || m === 'visa' || m === 'بطاقة') grouped[date].card += amount;
                else if (m === 'transfer' || m.includes('vodafone') || m.includes('instapay') || m.includes('تحويل')) grouped[date].transfer += amount;
                else grouped[date].cash += amount; // Fallback
            } catch (e) {
                // Ignore invalid dates
            }
        });

        // Sort by date logic (handling year crossing if needed, though 'month' implies current year usually)
        // Simplified sort by timestamp of the date string
        const chartData = Object.values(grouped).sort((a, b) => {
            const dateA = new Date(a.date + ', ' + now.getFullYear());
            const dateB = new Date(b.date + ', ' + now.getFullYear());
            return dateA - dateB;
        });

        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error(`[Dashboard Collections Chart Error] [${requestId}]`, error);
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch collections chart',
            code: 'COLLECTIONS_CHART_ERROR',
            requestId
        });
    }
});

/**
 * GET /api/dashboard/chart/refunds
 * Get refunds chart data
 */
router.get('/chart/refunds', authenticate, requirePermission('dashboard.view_financials'), async (req, res) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    try {
        if (req.user.role !== 'admin') {
            return res.json({ success: true, data: [] });
        }

        const { period = 'month' } = req.query;
        // VALIDATION
        const validPeriods = ['week', 'month', 'year'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: `Invalid period. Must be one of: ${validPeriods.join(', ')}`,
                requestId
            });
        }

        const now = new Date();
        let startDate;

        if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else {
            startDate = new Date(now.getFullYear(), 0, 1);
        }

        const refunds = await req.prisma.refund.findMany({
            where: {
                createdAt: { gte: startDate, lte: now }
            },
            select: { amount: true, createdAt: true }
        });

        // Group by date
        const grouped = {};
        refunds.forEach(r => {
            if (!r.createdAt) return;
            try {
                const date = new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                if (!grouped[date]) {
                    grouped[date] = { date, count: 0, amount: 0 };
                }
                grouped[date].count += 1;
                grouped[date].amount += r.amount || 0;
            } catch (e) {
                // Ignore
            }
        });

        // Sort by date
        const chartData = Object.values(grouped).sort((a, b) => {
            const dateA = new Date(a.date + ', ' + now.getFullYear());
            const dateB = new Date(b.date + ', ' + now.getFullYear());
            return dateA - dateB;
        });

        res.json({ success: true, data: chartData });
    } catch (error) {
        console.error(`[Dashboard Refunds Chart Error] [${requestId}]`, error);
        res.status(500).json({
            success: false,
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch refunds chart',
            code: 'REFUNDS_CHART_ERROR',
            requestId
        });
    }
});

module.exports = router;
