const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

const parseVisitMetadata = (notes) => {
    if (!notes || typeof notes !== 'string') return null;
    try {
        return JSON.parse(notes);
    } catch (error) {
        return null;
    }
};

/**
 * GET /api/attendance?member_id=1
 */
router.get('/', requirePermission(PERMISSIONS.CHECKINS_VIEW), async (req, res) => {
    try {
        const rawMemberId = req.query.member_id ?? req.query.memberId;
        const parsedMemberId = rawMemberId === undefined ? null : Number.parseInt(rawMemberId, 10);

        if (rawMemberId !== undefined && !Number.isInteger(parsedMemberId)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid member id' });
        }

        const where = {};
        if (Number.isInteger(parsedMemberId)) where.memberId = parsedMemberId;

        const rows = await req.prisma.checkIn.findMany({
            where,
            orderBy: { checkInTime: 'desc' },
            include: {
                member: {
                    select: {
                        id: true,
                        memberId: true,
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                },
                packageUsages: {
                    include: {
                        memberPackage: {
                            include: {
                                plan: true
                            }
                        }
                    },
                    orderBy: { dateTime: 'desc' },
                    take: 1
                }
            }
        });

        const data = rows.map((checkIn) => {
            const usage = checkIn.packageUsages?.[0] || null;
            const metadata = parseVisitMetadata(checkIn.notes);
            const visitType = metadata?.visitType || (usage ? 'PACKAGE' : 'MEMBERSHIP');

            return {
                id: checkIn.id,
                member_id: checkIn.memberId,
                member_pack_id: usage?.memberPackageId || null,
                session_name: usage?.sessionName || usage?.memberPackage?.sessionName || usage?.memberPackage?.plan?.name || null,
                session_price: usage?.sessionPrice ?? usage?.memberPackage?.sessionPrice ?? null,
                checked_in_at: checkIn.checkInTime,
                checked_out_at: checkIn.checkOutTime,
                method: checkIn.method,
                visitType,
                member: checkIn.member
            };
        });

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Attendance list error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to fetch attendance' });
    }
});

module.exports = router;
