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
    if (req.path === '/validate' && req.method === 'POST') {
        return next();
    }

    return requireActiveShift(req, res, next);
});

const buildNameFilters = (term) => {
    const fragments = term.split(' ').filter(Boolean);
    const filters = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } }
    ];
    if (fragments.length > 1) {
        filters.push(
            { firstName: { contains: fragments[0], mode: 'insensitive' } },
            { lastName: { contains: fragments[1], mode: 'insensitive' } }
        );
    }
    return filters;
};

const normalizePhoneCandidates = (digits) => {
    const withoutZero = digits.replace(/^0/, '');
    return [
        digits,
        '+' + '20' + withoutZero,
        withoutZero
    ];
};

const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
};

const resolveMemberForValidation = async (prisma, identifier) => {
    const cleaned = (identifier ?? '').toString().trim();
    if (!cleaned) return null;

    if (/^\d+$/.test(cleaned)) {
        const numericId = Number.parseInt(cleaned, 10);
        return prisma.member.findFirst({
            where: {
                OR: [
                    { id: Number.isNaN(numericId) ? -1 : numericId },
                    { memberId: cleaned },
                    { phone: { contains: cleaned } }
                ]
            }
        });
    }

    const matches = await prisma.member.findMany({
        where: {
            OR: [
                { memberId: { contains: cleaned, mode: 'insensitive' } },
                ...buildNameFilters(cleaned)
            ]
        },
        take: 2
    });
    if (matches.length === 1) {
        return matches[0];
    }
    return null;
};

const computeEligibility = async (prisma, member, mode) => {
    const now = new Date();
    const activeSubscription = await prisma.subscription.findFirst({
        where: {
            memberId: member.id,
            status: 'active',
            startDate: { lte: now },
            endDate: { gte: now },
            isPaused: false
        },
        orderBy: { endDate: 'desc' },
        include: { plan: true }
    });

    const hasActiveSubscription = Boolean(activeSubscription);
    const { start, end } = getTodayRange();
    const booking = await prisma.appointment.findFirst({
        where: {
            memberId: member.id,
            start: { gte: start, lt: end },
            status: { notIn: ['cancelled', 'no_show'] }
        }
    });
    const hasBookingToday = Boolean(booking);

    let eligible = false;
    let reason = 'NOT_ELIGIBLE';
    if (mode === 'session') {
        eligible = hasBookingToday;
    } else {
        eligible = hasActiveSubscription;
    }
    if (eligible) {
        reason = 'ELIGIBLE';
    }

    return { eligible, reason, hasActiveSubscription, hasBookingToday, activeSubscription };
};

/**
 * GET /api/checkin/search
 * Search members by name, phone, or member code
 */
router.get('/search', requirePermission(PERMISSIONS.CHECKINS_VIEW), async (req, res) => {
    try {
        const q = (req.query.q ?? req.query.query ?? req.query.searchq ?? '').toString().trim();
        if (!q) {
            return res.json({ success: true, data: [] });
        }

        const isNumeric = /^\d+$/.test(q);
        const where = isNumeric
            ? {
                OR: [
                    { phone: { contains: q } },
                    { memberId: { contains: q } }
                ]
            }
            : {
                OR: [
                    { memberId: { contains: q, mode: 'insensitive' } },
                    ...buildNameFilters(q)
                ]
            };

        const members = await req.prisma.member.findMany({
            where,
            take: 10,
            orderBy: { firstName: 'asc' }
        });

        const data = members.map(m => ({
            id: m.id,
            name: `${m.firstName} ${m.lastName}`.trim(),
            phone: m.phone,
            code: m.memberId
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Check-in search error:', error);
        return res.json({ success: true, data: [] });
    }
});

/**
 * POST /api/checkin/validate
 * Validate eligibility for check-in
 */
router.post('/validate', requirePermission(PERMISSIONS.CHECKINS_VIEW), async (req, res) => {
    try {
        const { memberId, query, mode } = req.body || {};
        const identifier = memberId ?? query ?? '';
        const member = await resolveMemberForValidation(req.prisma, identifier);

        if (!member) {
            return res.json({
                success: true,
                data: {
                    eligible: false,
                    reason: 'NOT_FOUND',
                    hasActiveSubscription: false,
                    hasBookingToday: false
                }
            });
        }

        const modeToUse = mode === 'session' ? 'session' : 'membership';
        const { eligible, reason, hasActiveSubscription, hasBookingToday } = await computeEligibility(req.prisma, member, modeToUse);

        return res.json({
            success: true,
            data: {
                eligible,
                reason,
                hasActiveSubscription,
                hasBookingToday
            }
        });
    } catch (error) {
        console.error('Check-in validate error:', error);
        return res.json({ success: true, data: null });
    }
});

/**
 * POST /api/checkin
 * Check-in a member
 */
router.post('/', requirePermission(PERMISSIONS.CHECKINS_MANAGE), async (req, res) => {
    try {
        const { memberId, query, method, source, mode } = req.body;
        const methodToUse = method || source || 'manual';

        const identifier = (memberId ?? query ?? '').toString().trim();
        if (!identifier) {
            return res.status(400).json({
                success: false,
                message: 'Member identifier is required'
            });
        }

        const searchOptions = {
            include: {
                subscriptions: {
                    where: { status: 'active' },
                    orderBy: { endDate: 'desc' },
                    take: 1,
                    include: { plan: true }
                }
            }
        };

        const findMemberByCode = async (code) => {
            return req.prisma.member.findFirst({
                where: {
                    memberId: code.trim()
                },
                ...searchOptions
            });
        };

        let member = null;

        if (memberId) {
            const parsedId = Number.parseInt(memberId, 10);
            if (!Number.isNaN(parsedId)) {
                member = await req.prisma.member.findUnique({
                    where: { id: parsedId },
                    ...searchOptions
                });
            }
            if (!member) {
                member = await findMemberByCode(memberId);
            }
        }

        if (!member && query) {
            const cleanedQuery = query.trim();
            if (/^\d{11}$/.test(cleanedQuery)) {
                member = await req.prisma.member.findFirst({
                    where: {
                        phone: {
                            in: normalizePhoneCandidates(cleanedQuery)
                        }
                    },
                    ...searchOptions
                });
            }

            if (!member && /^\d+$/.test(cleanedQuery)) {
                const numericId = Number.parseInt(cleanedQuery, 10);
                member = await req.prisma.member.findFirst({
                    where: {
                        OR: [
                            { id: numericId || 0 },
                            { memberId: cleanedQuery }
                        ]
                    },
                    ...searchOptions
                });
            }

            const codePattern = /^GYM[-_ ]?\d+$/i;
            if (!member && codePattern.test(cleanedQuery)) {
                member = await findMemberByCode(cleanedQuery);
            }

            if (!member && !/^\d+$/.test(cleanedQuery)) {
                const matches = await req.prisma.member.findMany({
                    where: { OR: buildNameFilters(cleanedQuery) },
                    take: 5,
                    ...searchOptions
                });

                if (matches.length === 1) {
                    member = matches[0];
                } else if (matches.length > 1) {
                    return res.status(409).json({
                        success: false,
                        message: 'Multiple members match this name. Use phone or member code.',
                        arabicMessage: 'يوجد أكثر من عضو بهذا الاسم. استخدم رقم الهاتف أو كود العضو.',
                        code: 'MULTIPLE_NAME_MATCHES',
                        candidates: matches.map(m => ({
                            id: m.id,
                            memberId: m.memberId,
                            name: m.firstName + ' ' + m.lastName,
                            phone: m.phone
                        }))
                    });
                }
            }
        }

        if (!member) {
            return res.status(400).json({
                success: false,
                message: 'العميل غير موجود',
                arabicMessage: 'العميل غير موجود',
                reason: 'NOT_FOUND',
                code: 'MEMBER_NOT_FOUND'
            });
        }
        if (!member.isActive) {
            return res.status(400).json({
                success: false,
                message: 'Member account is inactive',
                reason: 'NOT_ELIGIBLE',
                code: 'MEMBER_INACTIVE'
            });
        }

        // Check subscription status
        const modeToUse = mode === 'session' ? 'session' : 'membership';
        const { eligible, reason, activeSubscription } = await computeEligibility(req.prisma, member, modeToUse);
        let visitType = null;
        let appointmentUsed = null;
        let subscriptionResponse = null;

        if (!eligible) {
            return res.status(400).json({
                success: false,
                reason: 'NOT_ELIGIBLE',
                message: 'Not eligible for check-in',
                arabicMessage: 'غير مؤهل لتسجيل الدخول.'
            });
        }

        if (modeToUse === 'membership') {
            visitType = 'SUBSCRIPTION';
            subscriptionResponse = activeSubscription;
        } else {
            const { start, end } = getTodayRange();
            appointmentUsed = await req.prisma.appointment.findFirst({
                where: {
                    memberId: member.id,
                    start: { gte: start, lt: end },
                    status: { notIn: ['cancelled', 'no_show'] }
                },
                orderBy: { start: 'asc' }
            });
            visitType = 'SESSION';
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
        const metadata = { visitType };
        if (appointmentUsed) {
            metadata.appointmentId = appointmentUsed.id;
        }

        const checkIn = await req.prisma.checkIn.create({
            data: {
                memberId: member.id,
                method: methodToUse,
                notes: JSON.stringify(metadata)
            }
        });

        const now = new Date();
        const responsePayload = {
            checkIn,
            member: {
                id: member.id,
                memberId: member.memberId,
                firstName: member.firstName,
                lastName: member.lastName,
                photo: member.photo
            },
            visitType
        };

        if (visitType === 'SUBSCRIPTION' && subscriptionResponse) {
            const daysRemaining = Math.ceil((new Date(subscriptionResponse.endDate) - now) / (1000 * 60 * 60 * 24));
            responsePayload.subscription = {
                plan: subscriptionResponse.plan.name,
                endDate: subscriptionResponse.endDate,
                daysRemaining
            };
        }

        if (visitType === 'SESSION' && appointmentUsed) {
            responsePayload.appointment = {
                id: appointmentUsed.id,
                start: appointmentUsed.start,
                end: appointmentUsed.end,
                status: appointmentUsed.status
            };
        }

        res.json({
            success: true,
            message: 'Check-in successful',
            data: responsePayload
        });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(400).json({
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
