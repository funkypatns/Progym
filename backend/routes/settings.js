/**
 * ============================================
 * SETTINGS ROUTES
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

/**
 * GET /api/settings
 * Get all settings
 */
router.get('/', requirePermission(PERMISSIONS.SETTINGS_VIEW), async (req, res) => {
    try {
        const { group } = req.query;

        const where = group ? { group } : {};

        const settings = await req.prisma.setting.findMany({ where });

        // Convert to key-value object grouped by group
        const grouped = settings.reduce((acc, s) => {
            if (!acc[s.group]) acc[s.group] = {};

            // Parse value based on type
            let value = s.value;
            if (s.type === 'boolean') value = s.value === 'true';
            if (s.type === 'number') value = parseFloat(s.value);
            if (s.type === 'json') {
                try { value = JSON.parse(s.value); } catch (e) { }
            }

            acc[s.group][s.key] = value;
            return acc;
        }, {});

        res.json({
            success: true,
            data: grouped
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch settings'
        });
    }
});

/**
 * GET /api/settings/:key
 * Get single setting
 */
router.get('/:key', requirePermission(PERMISSIONS.SETTINGS_VIEW), async (req, res) => {
    try {
        const setting = await req.prisma.setting.findUnique({
            where: { key: req.params.key }
        });

        if (!setting) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        res.json({
            success: true,
            data: setting
        });

    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch setting'
        });
    }
});

/**
 * PUT /api/settings
 * Update multiple settings
 */
router.put('/', authorize('admin'), async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Settings object is required'
            });
        }

        const updates = [];

        for (const [key, value] of Object.entries(settings)) {
            let stringValue = value;
            let type = 'string';

            if (typeof value === 'boolean') {
                stringValue = value.toString();
                type = 'boolean';
            } else if (typeof value === 'number') {
                stringValue = value.toString();
                type = 'number';
            } else if (typeof value === 'object') {
                stringValue = JSON.stringify(value);
                type = 'json';
            }

            updates.push(
                req.prisma.setting.upsert({
                    where: { key },
                    update: { value: stringValue, type },
                    create: { key, value: stringValue, type, group: 'general' }
                })
            );
        }

        await Promise.all(updates);

        res.json({
            success: true,
            message: 'Settings updated successfully'
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update settings'
        });
    }
});

/**
 * PUT /api/settings/:key
 * Update single setting
 */
router.put('/:key', authorize('admin'), async (req, res) => {
    try {
        const { value, type, group } = req.body;

        const setting = await req.prisma.setting.upsert({
            where: { key: req.params.key },
            update: {
                value: String(value),
                ...(type && { type }),
                ...(group && { group })
            },
            create: {
                key: req.params.key,
                value: String(value),
                type: type || 'string',
                group: group || 'general'
            }
        });

        res.json({
            success: true,
            message: 'Setting updated',
            data: setting
        });

    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update setting'
        });
    }
});

/**
 * POST /api/settings/reset
 * Reset/Clear system data
 */
router.post('/reset', authorize('admin'), async (req, res) => {
    try {
        const { targets = [], date = null } = req.body;
        const result = { deleted: {} };

        // Helper for date filter
        const dateFilter = date ? { createdAt: { lt: new Date(date) } } : {};
        const isFullReset = targets.includes('all');

        // Order matters for constraints, wrap in transaction for atomicity
        await req.prisma.$transaction(async (tx) => {
            // 1. Logs & Notifications (No dependencies)
            if (isFullReset || targets.includes('logs')) {
                const { count } = await tx.activityLog.deleteMany({ where: dateFilter });
                await tx.auditLog.deleteMany({ where: dateFilter });
                result.deleted.logs = count;
            }

            if (isFullReset) {
                await tx.notification.deleteMany({ where: dateFilter });
                await tx.expense.deleteMany({ where: dateFilter });
                // Cash closing depends on User, but nothing depends on it
                await tx.cashClosing.deleteMany({ where: dateFilter });
            }

            // 2. Payments & Child Entities (Refunds)
            // CRITICAL: Delete Refunds first because they reference Payments.
            // If clearing members or subscriptions, we MUST clear payments first as they are children.
            if (isFullReset || targets.includes('payments') || targets.includes('members') || targets.includes('subscriptions')) {
                // Delete Orphans logic is handled by 'deleteMany' with same filter, but strict order is needed.
                const { count: rCount } = await tx.refund.deleteMany({ where: dateFilter });
                result.deleted.refunds = rCount;

                const { count } = await tx.payment.deleteMany({ where: dateFilter });
                result.deleted.payments = count;
            }

            // 3. Child Entities of Members
            // Check-ins
            if (isFullReset || targets.includes('members')) {
                const { count: c1 } = await tx.checkIn.deleteMany({ where: dateFilter });
                result.deleted.checkIns = c1;
            }

            // 4. Subscriptions (Depend on Member, Plan)
            // Payments are already deleted above, so Subscriptions can be deleted safely.
            if (isFullReset || targets.includes('subscriptions') || targets.includes('members')) {
                const { count } = await tx.subscription.deleteMany({ where: dateFilter });
                result.deleted.subscriptions = count;
            }

            // 5. Members (Parent of all above)
            if (isFullReset || targets.includes('members')) {
                const { count } = await tx.member.deleteMany({ where: dateFilter });
                result.deleted.members = count;
            }

            // 6. Plans & Shifts (Only on full reset)
            if (isFullReset) {
                // Delete plans (Parents of Subscriptions - Subs deleted above)
                const { count: pCount } = await tx.subscriptionPlan.deleteMany({ where: dateFilter });
                result.deleted.plans = pCount;

                // Close any open shifts and delete them
                // Shifts are parents of Payments (Payments deleted above)
                await tx.pOSShift.updateMany({
                    where: { status: 'open' },
                    data: { status: 'closed', closedAt: new Date() }
                });
                const { count: sCount } = await tx.pOSShift.deleteMany({ where: dateFilter });
                result.deleted.shifts = sCount;
            }

            // Factory Reset: Restore settings to defaults and re-seed essential data
            if (isFullReset && !date) {
                // Keep license-related settings!
                const licenseKeys = ['license_key', 'hardware_id', 'last_license_check'];

                // Delete all non-license settings
                await tx.setting.deleteMany({
                    where: { key: { notIn: licenseKeys } }
                });

                // Re-seed default settings
                const defaults = [
                    { key: 'gym_name', value: 'Gym Management System', type: 'string', group: 'general' },
                    { key: 'currency_code', value: 'USD', type: 'string', group: 'general' },
                    { key: 'currency_symbol', value: '$', type: 'string', group: 'general' },
                    { key: 'theme', value: 'dark', type: 'string', group: 'system' },
                    { key: 'language', value: 'en', type: 'string', group: 'system' }
                ];

                for (const s of defaults) {
                    await tx.setting.upsert({
                        where: { key: s.key },
                        update: s,
                        create: s
                    });
                }

                // Re-seed a default POS Machine to ensure terminal operations don't break
                await tx.pOSMachine.upsert({
                    where: { machineKey: 'default-counter-pos' },
                    update: { status: 'active' },
                    create: {
                        name: 'Counter POS',
                        machineKey: 'default-counter-pos',
                        status: 'active'
                    }
                });
            }
        }, {
            timeout: 60000 // Increased timeout for heavy cascading deletions
        });

        res.json({
            success: true,
            message: 'Data cleared successfully',
            data: result
        });

    } catch (error) {
        console.error('Reset data error:', error);
        res.status(500).json({
            success: false,
            message: `Failed to clear data: ${error.message}`
        });
    }
});

module.exports = router;
