/**
 * ============================================
 * STAFF NOTIFICATIONS ROUTES
 * ============================================
 * 
 * API endpoints for staff notification system
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/notifications/unread
 * Alias for unseen notifications list
 */
router.get('/unread', async (req, res) => {
    // Redirect logic to main list with unseenOnly=true
    req.query.unseenOnly = 'true';
    // We can't easily jump to another route handler in Express without internal redirect
    // So we'll just duplicate the simple logic or call a shared function if available.
    // Simplifying: just return the same as '/' but with unseenOnly forced.

    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            userId: req.user.id,
            seenAt: null
        };

        const [items, total] = await Promise.all([
            req.prisma.staffNotification.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    reminder: {
                        include: {
                            member: {
                                select: { id: true, memberId: true, firstName: true, lastName: true }
                            }
                        }
                    }
                }
            }),
            req.prisma.staffNotification.count({ where })
        ]);

        res.json({
            success: true,
            items, // Frontend might expect 'items' or 'data.notifications' - user req said { items, count }
            count: total
        });
    } catch (error) {
        console.error('[NOTIFICATIONS] Unread error:', error);
        res.status(500).json({ success: false, items: [], count: 0 });
    }
});

/**
 * GET /api/notifications/unseen-count
 * Get count of unseen notifications for current user
 */
router.get('/unseen-count', async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ success: true, data: { count: 0 } });
        }

        const count = await req.prisma.staffNotification.count({
            where: {
                userId: req.user.id,
                seenAt: null
            }
        });

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('[NOTIFICATIONS] Unseen count error:', error);
        // Do not crash the app for a notification count
        res.json({
            success: true,
            data: { count: 0 }
        });
    }
});

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, unseenOnly = false } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            userId: req.user.id
        };

        if (unseenOnly === 'true') {
            where.seenAt = null;
        }

        const [notifications, total, unseenCount] = await Promise.all([
            req.prisma.staffNotification.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    reminder: {
                        include: {
                            member: {
                                select: { id: true, memberId: true, firstName: true, lastName: true }
                            }
                        }
                    }
                }
            }),
            req.prisma.staffNotification.count({ where }),
            req.prisma.staffNotification.count({
                where: { userId: req.user.id, seenAt: null }
            })
        ]);

        res.json({
            success: true,
            data: {
                notifications,
                unseenCount,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('[NOTIFICATIONS] List error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
});

/**
 * GET /api/notifications/unseen-detailed
 * Get unseen notifications with full member and payment details for TTS
 */
router.get('/unseen-detailed', async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.json({ success: true, data: { notifications: [], count: 0 } });
        }

        const { limit = 10 } = req.query;

        const notifications = await req.prisma.staffNotification.findMany({
            where: {
                userId: req.user.id,
                seenAt: null,
                type: { in: ['PAYMENT_DUE', 'PAYMENT_OVERDUE'] }
            },
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include: {
                reminder: {
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
                            include: {
                                plan: {
                                    select: { name: true, price: true }
                                },
                                payments: {
                                    where: {
                                        status: { in: ['completed', 'refunded', 'Partial Refund'] }
                                    },
                                    select: {
                                        amount: true,
                                        refundedTotal: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const detailedNotifications = await Promise.all(
            notifications.map(async (notif) => {
                let remainingAmount = 0;
                let totalAmount = 0;
                let paidAmount = 0;
                let memberName = '';
                let memberPhone = '';
                let memberEmail = '';
                let memberCode = '';
                let subscriptionEnd = null;
                let subscriptionStart = null;
                let planName = '';
                let subscriptionVisits = 0;
                let allTimeVisits = 0;
                const currency = 'EGP';

                if (notif.reminder && notif.reminder.subscription) {
                    const sub = notif.reminder.subscription;
                    const payments = sub.payments || [];
                    totalAmount = sub.plan?.price || 0;
                    const grossPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                    const totalRefunded = payments.reduce((sum, p) => sum + (p.refundedTotal || 0), 0);
                    paidAmount = grossPaid - totalRefunded;
                    remainingAmount = Math.max(0, totalAmount - paidAmount);
                    subscriptionEnd = sub.endDate || null;
                    subscriptionStart = sub.startDate || null;
                    planName = sub.plan?.name || '';

                    if (sub.memberId) {
                        subscriptionVisits = await req.prisma.checkIn.count({
                            where: {
                                memberId: sub.memberId,
                                checkInTime: {
                                    gte: sub.startDate,
                                    lte: sub.endDate
                                }
                            }
                        });
                        allTimeVisits = await req.prisma.checkIn.count({
                            where: { memberId: sub.memberId }
                        });
                    }
                }

                if (notif.reminder && notif.reminder.member) {
                    memberName = `${notif.reminder.member.firstName} ${notif.reminder.member.lastName}`;
                    memberPhone = notif.reminder.member.phone || '';
                    memberEmail = notif.reminder.member.email || '';
                    memberCode = notif.reminder.member.memberId || '';
                }

                return {
                    id: notif.id,
                    type: notif.type,
                    priority: notif.priority,
                    title: notif.title,
                    message: notif.message,
                    createdAt: notif.createdAt,
                    memberName,
                    memberPhone,
                    memberEmail,
                    memberCode,
                    totalAmount,
                    paidAmount,
                    remainingAmount,
                    subscriptionStart,
                    subscriptionEnd,
                    planName,
                    visits: {
                        subscription: subscriptionVisits,
                        allTime: allTimeVisits
                    },
                    currency
                };
            })
        );

        res.json({
            success: true,
            data: {
                notifications: detailedNotifications,
                count: detailedNotifications.length
            }
        });

    } catch (error) {
        console.error('[NOTIFICATIONS] Unseen detailed error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch detailed notifications'
        });
    }
});

/**
 * POST /api/notifications/:id/seen
 * Mark a notification as seen
 */
router.post('/:id/seen', async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        const notification = await req.prisma.staffNotification.findUnique({
            where: { id: notificationId }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notification.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (notification.seenAt) {
            return res.json({
                success: true,
                message: 'Already marked as seen'
            });
        }

        await req.prisma.staffNotification.update({
            where: { id: notificationId },
            data: { seenAt: new Date() }
        });

        res.json({
            success: true,
            message: 'Notification marked as seen'
        });

    } catch (error) {
        console.error('[NOTIFICATIONS] Mark seen error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as seen'
        });
    }
});

/**
 * POST /api/notifications/mark-all-seen
 * Mark all notifications as seen for current user
 */
router.post('/mark-all-seen', async (req, res) => {
    try {
        const result = await req.prisma.staffNotification.updateMany({
            where: {
                userId: req.user.id,
                seenAt: null
            },
            data: {
                seenAt: new Date()
            }
        });

        res.json({
            success: true,
            message: `${result.count} notifications marked as seen`,
            data: { count: result.count }
        });

    } catch (error) {
        console.error('[NOTIFICATIONS] Mark all seen error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notifications as seen'
        });
    }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);

        const notification = await req.prisma.staffNotification.findUnique({
            where: { id: notificationId }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        if (notification.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await req.prisma.staffNotification.delete({
            where: { id: notificationId }
        });

        res.json({
            success: true,
            message: 'Notification deleted'
        });

    } catch (error) {
        console.error('[NOTIFICATIONS] Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification'
        });
    }
});

module.exports = router;
