/**
 * ============================================
 * SUBSCRIPTION ALERTS ROUTES
 * ============================================
 * 
 * Manages unread alert counts and acknowledgements
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * GET /api/subscription-alerts/unread-count
 * Get count of unacknowledged expired/cancelled subscriptions
 */
router.get('/unread-count', async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const notifyDaysSetting = await req.prisma.setting.findUnique({
            where: { key: 'notify_expiry_days' }
        });
        const notifyDays = parseInt(notifyDaysSetting?.value || 7);
        const expiryCutoff = new Date(todayStart);
        expiryCutoff.setDate(expiryCutoff.getDate() + notifyDays);

        // Count expired but unacknowledged
        const expiredCount = await req.prisma.subscription.count({
            where: {
                status: { in: ['expired', 'active'] },
                endDate: { lt: now },
                alertAcknowledged: false
            }
        });

        // Count cancelled but unacknowledged
        const cancelledCount = await req.prisma.subscription.count({
            where: {
                status: 'cancelled',
                alertAcknowledged: false
            }
        });

        // Count expiring soon (acknowledged per day)
        const expiringSoonCount = await req.prisma.subscription.count({
            where: {
                status: 'active',
                endDate: { gte: todayStart, lte: expiryCutoff },
                OR: [
                    { alertAcknowledgedAt: null },
                    { alertAcknowledgedAt: { lt: todayStart } }
                ]
            }
        });

        res.json({
            success: true,
            data: {
                count: expiredCount + cancelledCount + expiringSoonCount,
                breakdown: {
                    expired: expiredCount,
                    cancelled: cancelledCount,
                    expiringSoon: expiringSoonCount
                }
            }
        });
    } catch (error) {
        console.error('Get alert count error:', error);
        res.status(500).json({ success: false, message: 'Failed to get alert count' });
    }
});

/**
 * GET /api/subscription-alerts/unread
 * Get actual list of unread alerts
 */
router.get('/unread', async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const notifyDaysSetting = await req.prisma.setting.findUnique({
            where: { key: 'notify_expiry_days' }
        });
        const notifyDays = parseInt(notifyDaysSetting?.value || 7);
        const expiryCutoff = new Date(todayStart);
        expiryCutoff.setDate(expiryCutoff.getDate() + notifyDays);

        const alerts = await req.prisma.subscription.findMany({
            where: {
                OR: [
                    // Expired and unacknowledged
                    {
                        status: { in: ['expired', 'active'] },
                        endDate: { lt: now },
                        alertAcknowledged: false
                    },
                    // Cancelled and unacknowledged
                    {
                        status: 'cancelled',
                        alertAcknowledged: false
                    },
                    // Expiring soon (acknowledged per day)
                    {
                        status: 'active',
                        endDate: { gte: todayStart, lte: expiryCutoff },
                        OR: [
                            { alertAcknowledgedAt: null },
                            { alertAcknowledgedAt: { lt: todayStart } }
                        ]
                    }
                ]
            },
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true, email: true }
                },
                plan: { select: { name: true, price: true } },
                payments: {
                    where: { status: { in: ['completed', 'refunded', 'Partial Refund'] } },
                    select: { amount: true, refundedTotal: true }
                }
            },
            orderBy: { endDate: 'asc' }, // Oldest expirations first
            take: 150
        });

        res.json({
            success: true,
            data: alerts.map(sub => ({
                id: sub.id,
                type: sub.status === 'cancelled'
                    ? 'cancelled'
                    : (new Date(sub.endDate) < now ? 'expired' : 'expiring'),
                member: sub.member,
                planName: sub.plan.name,
                totalAmount: sub.plan?.price || 0,
                paidAmount: sub.payments.reduce((sum, p) => {
                    const gross = p.amount || 0;
                    const refunded = p.refundedTotal || 0;
                    return sum + (gross - refunded);
                }, 0),
                remainingAmount: Math.max(0, (sub.plan?.price || 0) - sub.payments.reduce((sum, p) => {
                    const gross = p.amount || 0;
                    const refunded = p.refundedTotal || 0;
                    return sum + (gross - refunded);
                }, 0)),
                endDate: sub.endDate,
                daysOverdue: Math.ceil((now - new Date(sub.endDate)) / (1000 * 60 * 60 * 24)),
                daysRemaining: Math.max(0, Math.ceil((new Date(sub.endDate) - now) / (1000 * 60 * 60 * 24)))
            }))
        });
    } catch (error) {
        console.error('Get unread alerts error:', error);
        res.status(500).json({ success: false, message: 'Failed to get alerts' });
    }
});

/**
 * POST /api/subscription-alerts/mark-read
 * Mark all or specific alerts as read
 */
router.post('/mark-read', async (req, res) => {
    try {
        const { ids } = req.body; // Optional: array of string IDs
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const notifyDaysSetting = await req.prisma.setting.findUnique({
            where: { key: 'notify_expiry_days' }
        });
        const notifyDays = parseInt(notifyDaysSetting?.value || 7);
        const expiryCutoff = new Date(todayStart);
        expiryCutoff.setDate(expiryCutoff.getDate() + notifyDays);

        const idFilter = ids && Array.isArray(ids) && ids.length > 0
            ? { id: { in: ids } }
            : {};

        // Mark expired/cancelled as acknowledged (permanent)
        const result = await req.prisma.subscription.updateMany({
            where: {
                ...idFilter,
                OR: [
                    {
                        status: { in: ['expired', 'active'] },
                        endDate: { lt: now },
                        alertAcknowledged: false
                    },
                    {
                        status: 'cancelled',
                        alertAcknowledged: false
                    }
                ]
            },
            data: {
                alertAcknowledged: true,
                alertAcknowledgedAt: now,
                alertAcknowledgedBy: req.user.id
            }
        });

        // Mark expiring-soon as acknowledged for the day only
        const expiringResult = await req.prisma.subscription.updateMany({
            where: {
                ...idFilter,
                status: 'active',
                endDate: { gte: todayStart, lte: expiryCutoff }
            },
            data: {
                alertAcknowledgedAt: now
            }
        });

        res.json({
            success: true,
            message: 'Alerts marked as read',
            count: result.count + expiringResult.count
        });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark alerts as read' });
    }
});

module.exports = router;
