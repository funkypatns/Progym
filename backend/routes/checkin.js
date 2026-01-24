/**
 * ============================================
 * CHECK-IN ROUTES
 * ============================================
 * 
 * Handles member check-in/check-out operations
 * Supports QR code, face recognition, and manual check-in
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission, requireActiveShift } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

// All write operations (except checkout) require an active shift
router.use(['/'], (req, res, next) => {
    // GET requests are allowed
    if (req.method === 'GET') {
        return next();
    }

    // Checkout is allowed without an active shift as it doesn't involve financial transactions
    if (req.path === '/checkout' && req.method === 'POST') {
        return next();
    }

    return requireActiveShift(req, res, next);
});

/**
 * POST /api/checkin
 * Check-in a member
 */
router.post('/', requirePermission(PERMISSIONS.CHECKINS_MANAGE), async (req, res) => {
    try {
        const { memberId, method = 'manual' } = req.body;

        // Find member by memberId string or ID
        const member = await req.prisma.member.findFirst({
            where: {
                OR: [
                    { id: parseInt(memberId) || 0 },
                    { memberId: memberId }
                ]
            },
            include: {
                subscriptions: {
                    where: { status: 'active' },
                    orderBy: { endDate: 'desc' },
                    take: 1,
                    include: { plan: true }
                }
            }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found',
                code: 'MEMBER_NOT_FOUND'
            });
        }

        if (!member.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Member account is inactive',
                code: 'MEMBER_INACTIVE'
            });
        }

        // Check subscription status
        const activeSubscription = member.subscriptions[0];

        if (!activeSubscription) {
            return res.status(400).json({
                success: false,
                message: 'No active subscription',
                code: 'NO_SUBSCRIPTION',
                member: {
                    id: member.id,
                    memberId: member.memberId,
                    name: `${member.firstName} ${member.lastName}`,
                    photo: member.photo
                }
            });
        }

        // Check if subscription is expired
        const now = new Date();
        if (new Date(activeSubscription.endDate) < now) {
            return res.status(400).json({
                success: false,
                message: 'Subscription has expired',
                code: 'SUBSCRIPTION_EXPIRED',
                member: {
                    id: member.id,
                    memberId: member.memberId,
                    name: `${member.firstName} ${member.lastName}`,
                    photo: member.photo
                },
                subscription: {
                    endDate: activeSubscription.endDate,
                    plan: activeSubscription.plan.name
                }
            });
        }

        // Check if subscription is frozen
        if (activeSubscription.status === 'frozen') {
            return res.status(400).json({
                success: false,
                message: 'Subscription is frozen',
                code: 'SUBSCRIPTION_FROZEN',
                member: {
                    id: member.id,
                    memberId: member.memberId,
                    name: `${member.firstName} ${member.lastName}`
                }
            });
        }

        // Check if already checked in today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const existingCheckIn = await req.prisma.checkIn.findFirst({
            where: {
                memberId: member.id,
                checkInTime: { gte: todayStart },
                checkOutTime: null
            }
        });

        if (existingCheckIn) {
            return res.status(400).json({
                success: false,
                message: 'Already checked in. Please check out first.',
                code: 'ALREADY_CHECKED_IN',
                checkIn: existingCheckIn
            });
        }

        // Create check-in
        const checkIn = await req.prisma.checkIn.create({
            data: {
                memberId: member.id,
                method
            }
        });

        // Calculate days remaining
        const daysRemaining = Math.ceil((new Date(activeSubscription.endDate) - now) / (1000 * 60 * 60 * 24));

        res.json({
            success: true,
            message: 'Check-in successful',
            data: {
                checkIn,
                member: {
                    id: member.id,
                    memberId: member.memberId,
                    firstName: member.firstName,
                    lastName: member.lastName,
                    photo: member.photo
                },
                subscription: {
                    plan: activeSubscription.plan.name,
                    endDate: activeSubscription.endDate,
                    daysRemaining
                }
            }
        });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Check-in failed'
        });
    }
});

/**
 * POST /api/checkin/checkout
 * Check-out a member
 */
router.post('/checkout', requirePermission(PERMISSIONS.CHECKINS_MANAGE), async (req, res) => {
    try {
        const { memberId } = req.body;
        if (memberId === undefined || memberId === null || memberId === '') {
            return res.status(400).json({
                success: false,
                message: 'Member ID is required'
            });
        }

        const parsedMemberId = Number.parseInt(memberId, 10);
        const memberIdString = typeof memberId === 'string' ? memberId.trim() : '';
        const memberLookup = [];

        if (Number.isInteger(parsedMemberId)) {
            memberLookup.push({ id: parsedMemberId });
        }
        if (memberIdString) {
            memberLookup.push({ memberId: memberIdString });
        }
        if (memberLookup.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid member ID format'
            });
        }

        // Find member
        const member = await req.prisma.member.findFirst({
            where: {
                OR: memberLookup
            }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Find latest open check-in (avoid date boundary issues)
        const checkIn = await req.prisma.checkIn.findFirst({
            where: {
                memberId: member.id,
                checkOutTime: null
            },
            orderBy: { checkInTime: 'desc' }
        });

        if (!checkIn) {
            return res.status(400).json({
                success: false,
                message: 'No active check-in found'
            });
        }

        // Update check-out time
        const updated = await req.prisma.checkIn.update({
            where: { id: checkIn.id },
            data: { checkOutTime: new Date() }
        });

        res.json({
            success: true,
            message: 'Check-out successful',
            data: {
                checkIn: updated,
                member: {
                    id: member.id,
                    memberId: member.memberId,
                    name: `${member.firstName} ${member.lastName}`
                }
            }
        });

    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({
            success: false,
            message: 'Check-out failed'
        });
    }
});

/**
 * GET /api/checkin/today
 * Get today's check-ins (Filtered by Shift for Staff)
 */
router.get('/today', requirePermission(PERMISSIONS.CHECKINS_VIEW), async (req, res) => {
    try {
        let where = {};

        // RBAC: Shift Isolation
        if (req.user.role !== 'admin') {
            // Staff sees only checkins since their shift opened
            // IMPORTANT: We need active shift info. We can't rely on 'requireActiveShift' middleware here 
            // because GET routes usually don't block on missing shift, but we need the shift start time.
            const posService = require('../services/posService');
            const activeShift = await posService.getOpenShiftForUser(req.user.id);

            if (activeShift) {
                where.checkInTime = { gte: activeShift.openedAt };
            } else {
                // No open shift = No data for staff
                return res.json({
                    success: true,
                    data: { checkIns: [], count: 0, activeCount: 0 }
                });
            }
        } else {
            // Admin sees "Today" (Midnight to Midnight)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            where.checkInTime = { gte: todayStart };
        }

        const checkIns = await req.prisma.checkIn.findMany({
            where,
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        photo: true
                    }
                }
            },
            orderBy: { checkInTime: 'desc' }
        });

        res.json({
            success: true,
            data: {
                checkIns,
                count: checkIns.length,
                activeCount: checkIns.filter(c => !c.checkOutTime).length
            }
        });

    } catch (error) {
        console.error('Get today check-ins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch check-ins'
        });
    }
});

/**
 * GET /api/checkin/history/:memberId
 * Get check-in history for a member
 */
router.get('/history/:memberId', async (req, res) => {
    try {
        const memberId = parseInt(req.params.memberId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [checkIns, total] = await Promise.all([
            req.prisma.checkIn.findMany({
                where: { memberId },
                skip,
                take: limit,
                orderBy: { checkInTime: 'desc' }
            }),
            req.prisma.checkIn.count({ where: { memberId } })
        ]);

        res.json({
            success: true,
            data: {
                checkIns,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get check-in history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch check-in history'
        });
    }
});

/**
 * GET /api/checkin/active
 * Get currently checked-in members
 */
router.get('/active', async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const activeCheckIns = await req.prisma.checkIn.findMany({
            where: {
                checkInTime: { gte: todayStart },
                checkOutTime: null
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        photo: true
                    }
                }
            },
            orderBy: { checkInTime: 'desc' }
        });

        res.json({
            success: true,
            data: {
                checkIns: activeCheckIns,
                count: activeCheckIns.length
            }
        });

    } catch (error) {
        console.error('Get active check-ins error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active check-ins'
        });
    }
});

/**
 * GET /api/checkin/stats/:memberId
 * Get attendance statistics for a member (for Refund Wizard)
 */
router.get('/stats/:memberId', async (req, res) => {
    try {
        const memberId = parseInt(req.params.memberId);
        const { startDate } = req.query; // ISO date string

        if (!memberId) {
            return res.status(400).json({ success: false, message: 'Member ID is required' });
        }

        // Build where clause
        const where = { memberId };
        if (startDate) {
            where.checkInTime = { gte: new Date(startDate) };
        }

        // Count total visits
        const totalVisits = await req.prisma.checkIn.count({ where });

        // Get last visit
        const lastVisitRecord = await req.prisma.checkIn.findFirst({
            where: { memberId },
            orderBy: { checkInTime: 'desc' },
            select: { checkInTime: true }
        });

        res.json({
            success: true,
            data: {
                totalVisits,
                lastVisit: lastVisitRecord?.checkInTime || null
            }
        });

    } catch (error) {
        console.error('Get check-in stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch check-in stats' });
    }
});

module.exports = router;
