const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

const parsePositiveInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toTemplateResponse = (row) => ({
    id: row.id,
    name: row.name,
    nameAr: row.nameAr || null,
    total_sessions: row.packageTotalSessions,
    totalSessions: row.packageTotalSessions,
    price_total: row.price,
    price: row.price,
    validity_days: row.packageValidityDays ?? null,
    validityDays: row.packageValidityDays ?? null,
    description: row.description || null,
    descriptionAr: row.descriptionAr || null,
    isActive: Boolean(row.isActive),
    businessTypeScope: null,
    created_at: row.createdAt,
    updated_at: row.updatedAt
});

const toPackagePayload = (input = {}) => {
    const packageTotalSessions = parsePositiveInt(input.packageTotalSessions ?? input.total_sessions ?? input.totalSessions);
    const packageValidityDays = parsePositiveInt(input.packageValidityDays ?? input.validity_days ?? input.validityDays);
    const price = Number(input.price_total ?? input.price ?? 0);
    const name = String(input.name || '').trim();

    return {
        name,
        nameAr: typeof input.nameAr === 'string' ? input.nameAr.trim() : null,
        type: 'PACKAGE',
        duration: packageValidityDays || 1,
        durationType: 'days',
        price: Number.isFinite(price) ? price : NaN,
        packageTotalSessions,
        packageValidityDays,
        packageSessionServiceId: parsePositiveInt(input.packageSessionServiceId),
        description: typeof input.description === 'string' ? input.description.trim() : null,
        descriptionAr: typeof input.descriptionAr === 'string' ? input.descriptionAr.trim() : null,
        isActive: input.isActive === undefined ? true : Boolean(input.isActive),
        sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0
    };
};

router.get('/', requirePermission(PERMISSIONS.PLANS_VIEW), async (req, res) => {
    try {
        const includeInactive = req.query.all === 'true';
        const q = String(req.query.q || '').trim();
        const items = await req.prisma.subscriptionPlan.findMany({
            where: {
                type: 'PACKAGE',
                ...(includeInactive ? {} : { isActive: true }),
                ...(q
                    ? {
                        OR: [
                            { name: { contains: q } },
                            { nameAr: { contains: q } }
                        ]
                    }
                    : {})
            },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
        });

        return res.json({ success: true, data: items.map(toTemplateResponse) });
    } catch (error) {
        console.error('Get package plans error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to fetch package plans' });
    }
});

router.post('/', requirePermission(PERMISSIONS.PLANS_MANAGE), async (req, res) => {
    try {
        const payload = toPackagePayload(req.body || {});
        if (!payload.name) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Package name is required' });
        }
        if (!Number.isFinite(payload.price) || payload.price < 0) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid package price' });
        }
        if (!Number.isInteger(payload.packageTotalSessions) || payload.packageTotalSessions <= 0) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Total sessions is required' });
        }

        const created = await req.prisma.subscriptionPlan.create({ data: payload });
        return res.status(201).json({ success: true, data: toTemplateResponse(created) });
    } catch (error) {
        console.error('Create package plan error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to create package plan' });
    }
});

router.patch('/:id', requirePermission(PERMISSIONS.PLANS_MANAGE), async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid package id' });
        }

        const payload = toPackagePayload(req.body || {});
        const updates = {};

        if (req.body.name !== undefined) {
            if (!payload.name) {
                return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Package name is required' });
            }
            updates.name = payload.name;
        }
        if (req.body.nameAr !== undefined) updates.nameAr = payload.nameAr;
        if (req.body.price !== undefined || req.body.price_total !== undefined) {
            if (!Number.isFinite(payload.price) || payload.price < 0) {
                return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid package price' });
            }
            updates.price = payload.price;
        }
        if (req.body.totalSessions !== undefined || req.body.total_sessions !== undefined || req.body.packageTotalSessions !== undefined) {
            if (!Number.isInteger(payload.packageTotalSessions) || payload.packageTotalSessions <= 0) {
                return res.status(400).json({ success: false, reason: 'BAD_REQUEST', message: 'Invalid total sessions' });
            }
            updates.packageTotalSessions = payload.packageTotalSessions;
        }
        if (req.body.validityDays !== undefined || req.body.validity_days !== undefined || req.body.packageValidityDays !== undefined) {
            updates.packageValidityDays = payload.packageValidityDays;
            updates.duration = payload.packageValidityDays || 1;
        }
        if (req.body.packageSessionServiceId !== undefined) updates.packageSessionServiceId = payload.packageSessionServiceId;
        if (req.body.description !== undefined) updates.description = payload.description;
        if (req.body.descriptionAr !== undefined) updates.descriptionAr = payload.descriptionAr;
        if (req.body.sortOrder !== undefined) updates.sortOrder = payload.sortOrder;
        if (req.body.isActive !== undefined) updates.isActive = payload.isActive;

        updates.type = 'PACKAGE';

        const updated = await req.prisma.subscriptionPlan.update({
            where: { id },
            data: updates
        });

        return res.json({ success: true, data: toTemplateResponse(updated) });
    } catch (error) {
        console.error('Update package plan error:', error);
        return res.status(500).json({ success: false, reason: 'SERVER_ERROR', message: 'Failed to update package plan' });
    }
});

module.exports = router;
