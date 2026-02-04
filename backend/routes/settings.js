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

        const dateObj = date ? new Date(date) : null;
        if (dateObj && Number.isNaN(dateObj.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date filter'
            });
        }

        const createdAtFilter = dateObj ? { createdAt: { lt: dateObj } } : {};
        const openedAtFilter = dateObj ? { openedAt: { lt: dateObj } } : {};
        const timestampFilter = dateObj ? { timestamp: { lt: dateObj } } : {};
        const paidAtFilter = dateObj ? { paidAt: { lt: dateObj } } : {};
        const saleItemDateFilter = dateObj ? { transaction: { createdAt: { lt: dateObj } } } : {};
        const isFullReset = targets.includes('all');

        // Order matters for constraints, wrap in transaction for atomicity
        await req.prisma.$transaction(async (tx) => {
            // 1. Logs & Notifications (No dependencies)
            if (isFullReset || targets.includes('logs')) {
                await tx.activityLog.deleteMany({ where: createdAtFilter });
                await tx.auditLog.deleteMany({ where: timestampFilter });
                await tx.notification.deleteMany({ where: createdAtFilter });
                await tx.staffNotification.deleteMany({ where: createdAtFilter });
                result.deleted.logs = true;
            }

            // 2. POS Machine & Retail Data (Full reset only)
            if (isFullReset) {
                // Delete Sale Items first (Children of SaleTransaction)
                await tx.saleItem.deleteMany({ where: saleItemDateFilter });
                // Delete Sale Transactions (Children of Shift, Employee)
                await tx.saleTransaction.deleteMany({ where: createdAtFilter });
                // Delete Stock Movements (Children of Product, Shift, Employee)
                await tx.stockMovement.deleteMany({ where: createdAtFilter });
                // Delete Products
                if (!date) await tx.product.deleteMany({});
            }

            // 3. Shift-related Financial Data
            if (isFullReset || targets.includes('payments')) {
                // Must delete Cash Movements before Shifts (References Shift)
                await tx.cashMovement.deleteMany({ where: createdAtFilter });
            }

            // 4. Payments & Child Entities (Refunds)
            // CRITICAL: Delete Refunds first because they reference Payments.
            if (isFullReset || targets.includes('payments') || targets.includes('members') || targets.includes('subscriptions')) {
                await tx.refund.deleteMany({ where: createdAtFilter });
                await tx.payment.deleteMany({ where: createdAtFilter });
            }

            // 5. Coach Earnings & Appointments (Must delete before Members and Users)
            if (isFullReset || targets.includes('payments') || targets.includes('members')) {
                // Delete coach earnings first (references Appointment)
                await tx.coachEarning.deleteMany({ where: createdAtFilter });
                // Delete trainer earnings first (references Appointment)
                await tx.trainerEarning.deleteMany({ where: createdAtFilter });
                // Delete financial records (references Appointment) -- FIX FOR RESET CRASH
                // Note: AppointmentFinancialRecord relies on appointmentId, must be deleted BEFORE appointment
                // However, we need to map dateFilter (createdAt) correctly or if it uses completedAt?
                // Schema says createdAt exists.
                await tx.appointmentFinancialRecord.deleteMany({ where: createdAtFilter });

                // Delete settlements (references Expense and Coach)
                await tx.coachSettlement.deleteMany({ where: createdAtFilter });
                // Delete trainer payouts (references StaffTrainer)
                await tx.trainerPayout.deleteMany({ where: paidAtFilter });
                // Delete appointments (references Member and Coach)
                await tx.appointment.deleteMany({ where: createdAtFilter });
            }

            // 6. Cash Closings (Reconciliation)
            if (isFullReset) {
                await tx.cashClosingAdjustment.deleteMany({ where: createdAtFilter });
                await tx.cashClosing.deleteMany({ where: createdAtFilter });
                // Delete receipts
                await tx.receipt.deleteMany({ where: createdAtFilter });
            }

            // 7. Expenses (Must be after CoachSettlement which references it)
            if (isFullReset) {
                await tx.expense.deleteMany({ where: createdAtFilter });
            }

            // 6. Reminders
            if (isFullReset || targets.includes('members') || targets.includes('subscriptions')) {
                await tx.reminder.deleteMany({ where: createdAtFilter });
            }

            // 7. Member Child Entities
            if (isFullReset || targets.includes('members')) {
                await tx.checkIn.deleteMany({ where: createdAtFilter });
            }

            // 8. Subscriptions (Depend on Member, Plan)
            if (isFullReset || targets.includes('subscriptions') || targets.includes('members')) {
                await tx.subscription.deleteMany({ where: createdAtFilter });
            }

            // 9. Members (Parent of all above)
            if (isFullReset || targets.includes('members')) {
                await tx.member.deleteMany({ where: createdAtFilter });
            }

            // 10. Shifts (Parent of Payments, CashMovements, etc.)
            if (isFullReset || targets.includes('payments')) {
                // Close any open shifts first
                await tx.pOSShift.updateMany({
                    where: { status: 'open' },
                    data: { status: 'closed', closedAt: new Date() }
                });
                await tx.pOSShift.deleteMany({ where: openedAtFilter });
            }

            // 11. Plans & Coach Settings (Only on full reset)
            if (isFullReset) {
                // Delete coach commission settings (references User)
                await tx.coachCommissionSettings.deleteMany({});
                await tx.subscriptionPlan.deleteMany({ where: createdAtFilter });
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
            timeout: 90000 // Increased timeout for heavy cascading deletions
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
            reason: 'RESET_FAILED',
            message: `Failed to clear data: ${error.message}`
        });
    }
});

module.exports = router;
