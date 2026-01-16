/**
 * ============================================
 * REMINDERS ROUTES
 * ============================================
 * 
 * API endpoints for payment reminder system
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const reminderService = require('../services/reminderService');
const { calculateMemberFinancials } = require('../utils/financialCalculations');

// All routes require authentication
router.use(authenticate);

// Permission constants
const PERMISSIONS = {
    REMINDERS_VIEW: 'reminders.view',
    REMINDERS_SEND: 'reminders.send',
    REMINDERS_SETTINGS: 'reminders.settings'
};

/**
 * GET /api/reminders/dashboard
 * Get reminder dashboard stats (due today, due soon, overdue)
 */
router.get('/dashboard', async (req, res) => {
    try {
        // Get dueSoonDays from settings
        const dueSoonDaysSetting = await req.prisma.setting.findUnique({
            where: { key: 'due_soon_days' }
        });
        const dueSoonDays = parseInt(dueSoonDaysSetting?.value || 3);

        const stats = await reminderService.getDashboardStats(dueSoonDays);

        res.json({
            success: true,
            data: {
                dueToday: stats.dueToday,
                dueSoon: stats.dueSoon,
                overdue: stats.overdue,
                totalMembers: stats.all.length,
                totalRemaining: stats.all.reduce((sum, m) => sum + m.remaining, 0),
                dueSoonDays // Include in response for frontend
            }
        });
    } catch (error) {
        console.error('[REMINDERS] Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reminder dashboard'
        });
    }
});

/**
 * GET /api/reminders/members
 * Get all members with remaining payments (for alerts page)
 */
router.get('/members', async (req, res) => {
    try {
        const { status, search, planId, sortBy = 'remaining', sortOrder = 'desc' } = req.query;

        let members = await reminderService.getMembersWithRemainingPayments();

        // Apply filters
        if (status) {
            // Get dueSoonDays from settings
            const dueSoonDaysSetting = await req.prisma.setting.findUnique({
                where: { key: 'due_soon_days' }
            });
            const dueSoonDays = parseInt(dueSoonDaysSetting?.value || 3);

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const dueSoonDate = new Date(today);
            dueSoonDate.setDate(dueSoonDate.getDate() + dueSoonDays);

            if (status === 'overdue') {
                members = members.filter(m => new Date(m.endDate) < today);
            } else if (status === 'dueToday') {
                members = members.filter(m => {
                    const end = new Date(m.endDate);
                    return end >= today && end < new Date(today.getTime() + 24 * 60 * 60 * 1000);
                });
            } else if (status === 'dueSoon') {
                members = members.filter(m => {
                    const end = new Date(m.endDate);
                    return end > today && end <= dueSoonDate;
                });
            }
        }

        if (search) {
            const searchLower = search.toLowerCase();
            members = members.filter(m =>
                m.memberName.toLowerCase().includes(searchLower) ||
                (m.memberPhone && m.memberPhone.includes(search))
            );
        }

        if (planId) {
            // Filter by plan would require additional data
        }

        // Sort
        members.sort((a, b) => {
            let aVal, bVal;
            if (sortBy === 'remaining') {
                aVal = a.remaining;
                bVal = b.remaining;
            } else if (sortBy === 'endDate') {
                aVal = new Date(a.endDate).getTime();
                bVal = new Date(b.endDate).getTime();
            } else if (sortBy === 'memberName') {
                aVal = a.memberName;
                bVal = b.memberName;
            } else {
                aVal = a.remaining;
                bVal = b.remaining;
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            }
            return aVal < bVal ? 1 : -1;
        });

        res.json({
            success: true,
            data: {
                members,
                count: members.length
            }
        });

    } catch (error) {
        console.error('[REMINDERS] Members list error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch members with remaining payments'
        });
    }
});

/**
 * GET /api/reminders
 * Get all reminders with filters
 */
router.get('/', async (req, res) => {
    try {
        const { status, type, from, to, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;
        if (type) where.type = type;
        if (from || to) {
            where.scheduledAt = {};
            if (from) where.scheduledAt.gte = new Date(from);
            if (to) where.scheduledAt.lte = new Date(to);
        }

        const [reminders, total] = await Promise.all([
            req.prisma.reminder.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { scheduledAt: 'desc' },
                include: {
                    member: {
                        select: { id: true, memberId: true, firstName: true, lastName: true, phone: true }
                    },
                    subscription: {
                        include: { plan: { select: { name: true } } }
                    }
                }
            }),
            req.prisma.reminder.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                reminders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('[REMINDERS] List error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reminders'
        });
    }
});

/**
 * POST /api/reminders/:id/send
 * Manually send a reminder
 */
router.post('/:id/send', async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id);
        const { channel = 'IN_APP' } = req.body;

        const reminder = await req.prisma.reminder.findUnique({
            where: { id: reminderId },
            include: {
                member: { select: { firstName: true, lastName: true, phone: true } }
            }
        });

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found'
            });
        }

        // For now, just mark as sent (SMS integration would go here)
        const updated = await req.prisma.reminder.update({
            where: { id: reminderId },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                channel
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'SEND_REMINDER',
                entityType: 'Reminder',
                entityId: reminderId,
                details: JSON.stringify({
                    channel,
                    memberName: `${reminder.member.firstName} ${reminder.member.lastName}`
                })
            }
        });

        res.json({
            success: true,
            message: 'Reminder sent successfully',
            data: updated
        });

    } catch (error) {
        console.error('[REMINDERS] Send error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reminder'
        });
    }
});

/**
 * POST /api/reminders/bulk-send
 * Send multiple reminders
 */
router.post('/bulk-send', async (req, res) => {
    try {
        const { reminderIds, channel = 'IN_APP' } = req.body;

        if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'reminderIds array is required'
            });
        }

        const updated = await req.prisma.reminder.updateMany({
            where: {
                id: { in: reminderIds.map(id => parseInt(id)) },
                status: 'PENDING'
            },
            data: {
                status: 'SENT',
                sentAt: new Date(),
                channel
            }
        });

        res.json({
            success: true,
            message: `${updated.count} reminders sent`,
            data: { count: updated.count }
        });

    } catch (error) {
        console.error('[REMINDERS] Bulk send error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reminders'
        });
    }
});

/**
 * POST /api/reminders/generate
 * Manually trigger reminder generation (admin only)
 */
router.post('/generate', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // Get gym name and dueSoonDays from settings
        const [gymNameSetting, dueSoonDaysSetting] = await Promise.all([
            req.prisma.setting.findUnique({ where: { key: 'gym_name' } }),
            req.prisma.setting.findUnique({ where: { key: 'due_soon_days' } })
        ]);
        const gymName = gymNameSetting?.value || 'النادي';
        const dueSoonDays = parseInt(dueSoonDaysSetting?.value || 3);

        const results = await reminderService.runDailyReminderJob(gymName, dueSoonDays);

        res.json({
            success: true,
            message: 'Reminders generated',
            data: results
        });

    } catch (error) {
        console.error('[REMINDERS] Generate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate reminders'
        });
    }
});

/**
 * POST /api/reminders/test
 * Test reminder generation (Admin only)
 */
router.post('/test', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { memberId } = req.body;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                message: 'memberId is required'
            });
        }

        const id = parseInt(memberId);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid memberId'
            });
        }

        // Fetch member with all financial data
        const member = await req.prisma.member.findUnique({
            where: { id },
            include: {
                subscriptions: {
                    include: {
                        plan: true,
                        payments: {
                            where: { status: { in: ['completed', 'refunded', 'Partial Refund'] } }
                        }
                    }
                }
            }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const financials = calculateMemberFinancials(member);

        if (financials.totalRemaining <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Member has no outstanding balance'
            });
        }

        // Create TEST reminder
        const reminder = await req.prisma.reminder.create({
            data: {
                memberId: member.id,
                channel: 'IN_APP',
                type: 'TEST',
                status: 'SENT',
                sentAt: new Date(),
                scheduledAt: new Date(),
                message: 'Test Reminder'
            }
        });

        // Create notification for current admin
        const notification = await req.prisma.staffNotification.create({
            data: {
                userId: req.user.id, // Current admin
                reminderId: reminder.id,
                type: 'PAYMENT_DUE',
                title: 'Test Alert',
                message: `Test alert for ${member.firstName} ${member.lastName}`,
                priority: 'NORMAL'
            }
        });

        res.json({
            success: true,
            data: {
                memberName: `${member.firstName} ${member.lastName}`,
                remainingAmount: financials.totalRemaining,
                currency: 'EGP',
                notificationId: notification.id,
                createdAt: new Date()
            }
        });

    } catch (error) {
        console.error('[REMINDERS] Test error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate test reminder'
        });
    }
});

/**
 * POST /api/reminders/send-now
 * Force send reminder now (Admin only)
 */
router.post('/send-now', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { memberId } = req.body;
        const widthDetails = true; // To populate result

        const member = await req.prisma.member.findUnique({
            where: { id: parseInt(memberId) },
            include: {
                subscriptions: {
                    where: { status: 'active' },
                    include: {
                        plan: true,
                        payments: true
                    }
                }
            }
        });

        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Just use the first active subscription for the reminder context
        const subscription = member.subscriptions[0];

        // We use the service but force it
        // Since service functions are "detect...", we might simply create it successfully manually here
        // But let's use createReminder if we can calculate data.
        // Actually, simplest is to manually create it like the test one but as a real 'MANUAL' type

        const reminder = await req.prisma.reminder.create({
            data: {
                memberId: member.id,
                subscriptionId: subscription?.id, // Optional
                channel: 'IN_APP',
                type: 'MANUAL', // New type
                status: 'PENDING', // Pending so it gets picked up? Or SENT? User said "Create real reminder NOW". 
                // Using PENDING ensures it follows standard flows (like if we add SMS later). 
                // But user said "send-now". Let's set SENT and create notifications immediately.
                status: 'SENT',
                sentAt: new Date(),
                scheduledAt: new Date(),
                message: 'Manual Reminder'
            }
        });

        // Create notifications
        await reminderService.createStaffNotifications(reminder, 'HIGH');

        res.json({
            success: true,
            message: 'Reminder sent successfully',
            data: reminder
        });

    } catch (error) {
        console.error('[REMINDERS] Send now error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reminder'
        });
    }
});

/**
 * DELETE /api/reminders/:id
 * Cancel a pending reminder
 */
router.delete('/:id', async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id);

        const reminder = await req.prisma.reminder.findUnique({
            where: { id: reminderId }
        });

        if (!reminder) {
            return res.status(404).json({
                success: false,
                message: 'Reminder not found'
            });
        }

        if (reminder.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'Only pending reminders can be cancelled'
            });
        }

        await req.prisma.reminder.update({
            where: { id: reminderId },
            data: { status: 'CANCELLED' }
        });

        res.json({
            success: true,
            message: 'Reminder cancelled'
        });

    } catch (error) {
        console.error('[REMINDERS] Delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel reminder'
        });
    }
});

module.exports = router;
