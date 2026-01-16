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

        res.json({
            success: true,
            data: {
                count: expiredCount + cancelledCount,
                breakdown: {
                    expired: expiredCount,
                    cancelled: cancelledCount
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
                    }
                ]
            },
            include: {
                member: {
                    select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                },
                plan: { select: { name: true } }
            },
            orderBy: { endDate: 'asc' }, // Oldest expirations first
            take: 100
        });

        res.json({
            success: true,
            data: alerts.map(sub => ({
                id: sub.id,
                type: sub.status === 'cancelled' ? 'cancelled' : 'expired',
                member: sub.member,
                planName: sub.plan.name,
                endDate: sub.endDate,
                daysOverdue: Math.ceil((now - new Date(sub.endDate)) / (1000 * 60 * 60 * 24))
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

        const where = {};

        // If specific IDs provided
        if (ids && Array.isArray(ids) && ids.length > 0) {
            where.id = { in: ids };
        } else {
            // Otherwise match all unacknowledged expired/cancelled
            where.OR = [
                {
                    status: { in: ['expired', 'active'] },
                    endDate: { lt: now },
                    alertAcknowledged: false
                },
                {
                    status: 'cancelled',
                    alertAcknowledged: false
                }
            ];
        }

        const result = await req.prisma.subscription.updateMany({
            where,
            data: {
                alertAcknowledged: true,
                alertAcknowledgedAt: now,
                alertAcknowledgedBy: req.user.id
            }
        });

        res.json({
            success: true,
            message: 'Alerts marked as read',
            count: result.count
        });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark alerts as read' });
    }
});

module.exports = router;
