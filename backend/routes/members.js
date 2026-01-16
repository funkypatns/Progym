/**
 * ============================================
 * MEMBER MANAGEMENT ROUTES
 * ============================================
 * 
 * CRUD operations for gym members
 * Includes photo upload and QR code generation
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { body, validationResult, query } = require('express-validator');
const { authenticate, authorize, requireActiveShift, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(req.userDataPath, 'uploads', 'members');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'member-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate unique member ID
 */
async function generateMemberId(prisma) {
    const lastMember = await prisma.member.findFirst({
        orderBy: { id: 'desc' }
    });

    const nextNum = lastMember ? parseInt(lastMember.memberId.split('-')[1]) + 1 : 1;
    return `GYM-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Generate QR code for member
 */
async function generateQRCode(memberId, userDataPath) {
    const qrDir = path.join(userDataPath, 'uploads', 'qrcodes');
    if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrPath = path.join(qrDir, `${memberId}.png`);
    await QRCode.toFile(qrPath, memberId, {
        width: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    });

    return `/uploads/qrcodes/${memberId}.png`;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/members
 * Get all members with pagination and search
 */
router.get('/', requirePermission(PERMISSIONS.MEMBERS_VIEW), [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim(),
    query('status').optional().isIn(['active', 'inactive', 'all']),
    query('gender').optional().isIn(['male', 'female', 'unknown'])
], async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'all';
        const gender = req.query.gender;

        // Build where clause
        const where = {};
        const andConditions = [];

        if (search) {
            andConditions.push({
                OR: [
                    { firstName: { contains: search } },
                    { lastName: { contains: search } },
                    { memberId: { contains: search } },
                    { phone: { contains: search } },
                    { email: { contains: search } }
                ]
            });
        }

        if (status !== 'all') {
            const now = new Date();

            if (status === 'inactive') {
                // "Inactive" = Has NO subscription OR (All subscriptions are expired/cancelled)
                andConditions.push({
                    OR: [
                        { subscriptions: { none: {} } },
                        {
                            subscriptions: {
                                every: {
                                    OR: [
                                        { status: { not: 'active' } },
                                        { endDate: { lt: now } }
                                    ]
                                }
                            }
                        }
                    ]
                });
            } else if (status === 'active') {
                // "Active" = Has at least one active subscription that hasn't ended
                andConditions.push({
                    subscriptions: {
                        some: {
                            status: 'active',
                            endDate: { gte: now }
                        }
                    }
                });
            }
        }

        if (gender) {
            if (gender === 'unknown') {
                andConditions.push({
                    OR: [
                        { gender: null },
                        { gender: 'unknown' }
                    ]
                });
            } else {
                andConditions.push({ gender });
            }
        }

        if (andConditions.length > 0) {
            where.AND = andConditions;
        }

        // Get members with active subscription info and last check-in
        const [members, total] = await Promise.all([
            req.prisma.member.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    subscriptions: {
                        where: { status: 'active' },
                        orderBy: { endDate: 'desc' },
                        take: 1,
                        include: {
                            plan: true
                        }
                    },
                    checkIns: {
                        orderBy: { checkInTime: 'desc' },
                        take: 1
                    }
                }
            }),
            req.prisma.member.count({ where })
        ]);

        // Inactive threshold in days (configurable)
        const INACTIVE_THRESHOLD_DAYS = 10;
        const VERY_INACTIVE_THRESHOLD_DAYS = 30;
        const now = new Date();

        // Add subscription status and inactive detection to each member
        const membersWithStatus = members.map(member => {
            const activeSubscription = member.subscriptions[0];
            let subscriptionStatus = 'none';
            let daysRemaining = 0;

            if (activeSubscription) {
                const endDate = new Date(activeSubscription.endDate);
                daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

                if (daysRemaining > 7) {
                    subscriptionStatus = 'active';
                } else if (daysRemaining > 0) {
                    subscriptionStatus = 'expiring';
                } else {
                    subscriptionStatus = 'expired';
                }
            }

            // Calculate inactive status based on last check-in
            const lastCheckIn = member.checkIns[0]?.checkInTime || null;
            let daysSinceLastCheckIn = null;
            let isInactive = false;
            let isVeryInactive = false;

            if (lastCheckIn) {
                daysSinceLastCheckIn = Math.floor((now - new Date(lastCheckIn)) / (1000 * 60 * 60 * 24));
                isInactive = daysSinceLastCheckIn >= INACTIVE_THRESHOLD_DAYS;
                isVeryInactive = daysSinceLastCheckIn >= VERY_INACTIVE_THRESHOLD_DAYS;
            } else if (member.joinDate) {
                // Member never checked in - consider inactive if joined more than threshold days ago
                const daysSinceJoin = Math.floor((now - new Date(member.joinDate)) / (1000 * 60 * 60 * 24));
                isInactive = daysSinceJoin >= INACTIVE_THRESHOLD_DAYS;
                isVeryInactive = daysSinceJoin >= VERY_INACTIVE_THRESHOLD_DAYS;
            }

            return {
                ...member,
                subscriptionStatus,
                daysRemaining,
                currentPlan: activeSubscription?.plan?.name || null,
                lastCheckIn,
                daysSinceLastCheckIn,
                isInactive,
                isVeryInactive
            };
        });

        res.json({
            success: true,
            data: {
                members: membersWithStatus,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch members'
        });
    }
});

/**
 * GET /api/members/:id
 * Get single member by ID
 */
router.get('/:id', requirePermission(PERMISSIONS.MEMBERS_VIEW), async (req, res) => {
    try {
        const member = await req.prisma.member.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    include: { plan: true }
                },
                checkIns: {
                    orderBy: { checkInTime: 'desc' },
                    take: 10
                },
                payments: {
                    orderBy: { paidAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        res.json({
            success: true,
            data: member
        });

    } catch (error) {
        console.error('Get member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch member'
        });
    }
});

/**
 * POST /api/members
 * Create new member
 */
router.post('/', requirePermission('members.create'), upload.single('photo'), [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('gender').optional({ nullable: true }).isIn(['male', 'female', 'unknown']).withMessage('Invalid gender')
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
            firstName,
            lastName,
            email,
            phone,
            address,
            dateOfBirth,
            gender,
            emergencyContactName,
            emergencyContactPhone,
            notes
        } = req.body;

        // Generate unique member ID
        const memberId = await generateMemberId(req.prisma);

        // Handle photo upload
        let photoPath = null;
        if (req.file) {
            photoPath = `/uploads/members/${req.file.filename}`;
        }

        // Generate QR code
        const qrCodePath = await generateQRCode(memberId, req.userDataPath);

        // Create member
        const member = await req.prisma.member.create({
            data: {
                memberId,
                firstName,
                lastName,
                email: email || null,
                phone,
                address: address || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender: gender || null,
                photo: photoPath,
                qrCode: qrCodePath,
                emergencyContactName: emergencyContactName || null,
                emergencyContactPhone: emergencyContactPhone || null,
                notes: notes || null,
                isActive: true
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'CREATE_MEMBER',
                entityType: 'Member',
                entityId: member.id,
                details: JSON.stringify({ memberId: member.memberId })
            }
        });

        res.status(201).json({
            success: true,
            message: 'Member created successfully',
            data: member
        });

    } catch (error) {
        console.error('Create member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create member'
        });
    }
});

/**
 * PUT /api/members/:id
 * Update member
 */
router.put('/:id', requirePermission(PERMISSIONS.MEMBERS_EDIT), upload.single('photo'), [
    body('gender').optional({ nullable: true }).isIn(['male', 'female', 'unknown']).withMessage('Invalid gender')
], async (req, res) => {
    try {
        const memberId = parseInt(req.params.id);

        // Check if member exists
        const existingMember = await req.prisma.member.findUnique({
            where: { id: memberId }
        });

        if (!existingMember) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            address,
            dateOfBirth,
            gender,
            emergencyContactName,
            emergencyContactPhone,
            notes,
            isActive
        } = req.body;

        // Handle photo upload
        let photoPath = existingMember.photo;
        if (req.file) {
            photoPath = `/uploads/members/${req.file.filename}`;

            // Delete old photo if exists
            if (existingMember.photo) {
                const oldPhotoPath = path.join(req.userDataPath, existingMember.photo);
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }
        }

        // Update member
        const member = await req.prisma.member.update({
            where: { id: memberId },
            data: {
                ...(firstName && { firstName }),
                ...(lastName && { lastName }),
                email: email || null,
                ...(phone && { phone }),
                address: address || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender: gender || null,
                photo: photoPath,
                emergencyContactName: emergencyContactName || null,
                emergencyContactPhone: emergencyContactPhone || null,
                notes: notes || null,
                ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true })
            }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'UPDATE_MEMBER',
                entityType: 'Member',
                entityId: member.id
            }
        });

        res.json({
            success: true,
            message: 'Member updated successfully',
            data: member
        });

    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update member'
        });
    }
});

/**
 * DELETE /api/members/:id
 * Delete member (soft delete - sets isActive to false)
 */
router.delete('/:id', requirePermission(PERMISSIONS.MEMBERS_DELETE), async (req, res) => {
    try {
        const memberId = parseInt(req.params.id);

        const member = await req.prisma.member.update({
            where: { id: memberId },
            data: { isActive: false }
        });

        // Log activity
        await req.prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'DELETE_MEMBER',
                entityType: 'Member',
                entityId: memberId
            }
        });

        res.json({
            success: true,
            message: 'Member deleted successfully'
        });

    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete member'
        });
    }
});

/**
 * GET /api/members/:id/qrcode
 * Get member QR code
 */
router.get('/:id/qrcode', async (req, res) => {
    try {
        const member = await req.prisma.member.findUnique({
            where: { id: parseInt(req.params.id) },
            select: { memberId: true, qrCode: true }
        });

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Generate QR code as base64
        const qrDataUrl = await QRCode.toDataURL(member.memberId, {
            width: 300,
            margin: 2
        });

        res.json({
            success: true,
            data: {
                memberId: member.memberId,
                qrCode: qrDataUrl
            }
        });

    } catch (error) {
        console.error('Get QR code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate QR code'
        });
    }
});

/**
 * GET /api/members/search/:query
 * Quick search for members
 */
router.get('/search/:query', requirePermission(PERMISSIONS.MEMBERS_VIEW), async (req, res) => {
    try {
        const query = req.params.query;

        const members = await req.prisma.member.findMany({
            where: {
                OR: [
                    { firstName: { contains: query } },
                    { lastName: { contains: query } },
                    { memberId: { contains: query } },
                    { phone: { contains: query } }
                ],
                isActive: true
            },
            take: 10,
            select: {
                id: true,
                memberId: true,
                firstName: true,
                lastName: true,
                phone: true,
                photo: true
            }
        });

        res.json({
            success: true,
            data: members
        });

    } catch (error) {
        console.error('Search members error:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed'
        });
    }
});

/**
 * GET /api/members/:id/history
 * Get member activity history for timeline
 */
router.get('/:id/history', requirePermission(PERMISSIONS.MEMBERS_VIEW), async (req, res) => {
    try {
        const memberId = parseInt(req.params.id);

        // Fetch all history data in parallel
        const [member, subscriptions, checkIns, payments] = await Promise.all([
            req.prisma.member.findUnique({
                where: { id: memberId },
                select: { id: true, memberId: true, firstName: true, lastName: true, joinDate: true }
            }),
            req.prisma.subscription.findMany({
                where: { memberId },
                orderBy: { createdAt: 'desc' },
                include: { plan: true }
            }),
            req.prisma.checkIn.findMany({
                where: { memberId },
                orderBy: { checkInTime: 'desc' },
                take: 50
            }),
            req.prisma.payment.findMany({
                where: { memberId },
                orderBy: { paidAt: 'desc' },
                take: 20
            })
        ]);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Build timeline events
        const timeline = [];

        // Add join event
        timeline.push({
            type: 'joined',
            title: 'Member Joined',
            titleAr: 'انضم للنادي',
            date: member.joinDate,
            icon: 'user-plus'
        });

        // Add subscription events
        subscriptions.forEach(sub => {
            timeline.push({
                type: 'subscription',
                title: `Subscription: ${sub.plan.name}`,
                titleAr: `اشتراك: ${sub.plan.nameAr || sub.plan.name}`,
                description: `${sub.startDate.toISOString().split('T')[0]} to ${sub.endDate.toISOString().split('T')[0]}`,
                date: sub.createdAt,
                status: sub.status,
                icon: 'credit-card'
            });
        });

        // Add check-in events
        checkIns.forEach(checkIn => {
            timeline.push({
                type: 'checkin',
                title: 'Check-in',
                titleAr: 'تسجيل دخول',
                date: checkIn.checkInTime,
                checkOutTime: checkIn.checkOutTime,
                icon: 'log-in'
            });
        });

        // Add payment events
        payments.forEach(payment => {
            timeline.push({
                type: 'payment',
                title: `Payment: ${payment.amount}`,
                titleAr: `دفعة: ${payment.amount}`,
                description: payment.method,
                date: payment.paidAt,
                icon: 'dollar-sign'
            });
        });

        // Sort by date descending
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            data: {
                member,
                timeline,
                stats: {
                    totalSubscriptions: subscriptions.length,
                    totalCheckIns: checkIns.length,
                    totalPayments: payments.length
                }
            }
        });

    } catch (error) {
        console.error('Get member history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch member history'
        });
    }
});

/**
 * GET /api/members/:id/details
 * comprehensive member details for modal
 */
router.get('/:id/details', requirePermission(PERMISSIONS.MEMBERS_VIEW), async (req, res) => {
    try {
        const memberId = parseInt(req.params.id);

        const member = await req.prisma.member.findUnique({
            where: { id: memberId },
            include: {
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    include: { plan: true }
                },
                payments: {
                    orderBy: { paidAt: 'desc' },
                    include: {
                        creator: { select: { firstName: true, lastName: true } },
                        refunds: {
                            include: { user: { select: { firstName: true, lastName: true } } }
                        }
                    }
                },
                checkIns: {
                    orderBy: { checkInTime: 'desc' },
                    take: 20
                }
            }
        });

        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Calculate Financials
        let totalPaid = 0;
        let totalRefunded = 0;
        let subscriptionTotal = member.subscriptions.reduce((sum, sub) => sum + (sub.price || sub.plan.price), 0);
        const byMethod = { cash: 0, card: 0, transfer: 0 };

        member.payments.forEach(p => {
            const amount = p.amount || 0;
            const method = (p.method || 'cash').toLowerCase();

            if (p.status === 'completed' || p.status === 'refunded' || p.status === 'Partial Refund') {
                totalPaid += amount;
                if (byMethod[method] !== undefined) byMethod[method] += amount;
            }

            p.refunds.forEach(r => {
                totalRefunded += (r.amount || 0);
                if (byMethod[method] !== undefined) byMethod[method] -= (r.amount || 0);
            });
        });

        // Current Subscription
        const activeSub = member.subscriptions.find(s => s.status === 'active');
        const subscriptionInfo = activeSub ? {
            planName: activeSub.plan.name,
            startDate: activeSub.startDate,
            endDate: activeSub.endDate,
            remainingDays: Math.ceil((new Date(activeSub.endDate) - new Date()) / (1000 * 60 * 60 * 24)),
            price: activeSub.price || activeSub.plan.price
        } : null;

        // Refund History
        const allRefunds = [];
        member.payments.forEach(p => {
            if (p.refunds && p.refunds.length > 0) {
                p.refunds.forEach(r => {
                    allRefunds.push({
                        id: r.id,
                        date: r.createdAt,
                        amount: r.amount,
                        reason: r.reason,
                        method: p.method,
                        subscriptionName: member.subscriptions.find(s => s.id === p.subscriptionId)?.plan.name || 'N/A',
                        performedBy: r.user ? `${r.user.firstName} ${r.user.lastName}` : 'System'
                    });
                });
            }
        });
        allRefunds.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({
            success: true,
            data: {
                basicInfo: {
                    id: member.id,
                    memberId: member.memberId,
                    name: `${member.firstName} ${member.lastName}`,
                    phone: member.phone,
                    gender: member.gender,
                    status: member.isActive ? 'Active' : 'Inactive',
                    joinDate: member.joinDate,
                    photo: member.photo
                },
                subscriptionInfo,
                financialSummary: {
                    totalPaid,
                    totalRefunded,
                    totalDue: subscriptionTotal,
                    net: totalPaid - totalRefunded,
                    byMethod
                },
                activity: {
                    payments: member.payments.slice(0, 10).map(p => ({
                        id: p.id,
                        date: p.paidAt,
                        amount: p.amount,
                        method: p.method,
                        status: p.status
                    })),
                    checkIns: member.checkIns.map(c => ({
                        id: c.id,
                        date: c.checkInTime,
                        time: c.checkInTime
                    })),
                    refunds: allRefunds
                }
            }
        });

    } catch (error) {
        console.error('Get member details error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch member details' });
    }
});

module.exports = router;

