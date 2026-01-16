const express = require('express');
const router = express.Router();
const { requireAnyPermission } = require('../middleware/auth');

/**
 * GET /api/alerts/subscriptions/unack-count
 * Lightweight endpoint for sidebar badges
 */
router.get('/subscriptions/unack-count', requireAnyPermission('subscriptions.view', 'alerts.view'), async (req, res) => {
    try {
        console.log('[DEBUG] Fetching global unack subscription count...');
        const now = new Date();
        const rawCount = await req.prisma.subscription.count({
            where: {
                OR: [
                    { status: 'expired' },
                    { status: 'cancelled' },
                    { status: 'ended' },
                    { status: 'active', endDate: { lte: now } }
                ],
                alertAcknowledged: false
            }
        });

        const count = rawCount >= 100 ? 100 : rawCount;

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('Get alert count error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch alert count' });
    }
});

/**
 * POST /api/alerts/subscriptions/ack-all
 * Alias for marking all alerts as reviewed
 */
router.post('/subscriptions/ack-all', requireAnyPermission('subscriptions.view', 'alerts.view'), async (req, res) => {
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

module.exports = router;
