/**
 * ============================================
 * CASH MOVEMENTS ROUTES (Pay In / Pay Out)
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { authenticate, requireActiveShift } = require('../middleware/auth');

router.use(authenticate);

// Validation Rules
const movementValidation = [
    body('type').isIn(['IN', 'OUT']).withMessage('Type must be IN or OUT'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('notes').optional().trim()
];

/**
 * POST /api/cash-movements
 * Create a new cash movement (Pay In / Pay Out)
 * Requires active shift
 */
router.post('/', requireActiveShift, movementValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { type, amount, reason, notes } = req.body;

        console.log(`[CASH MOVEMENT] POST Request: Type=${type}, Amount=${amount}, Reason=${reason}`);

        // Defensive checks
        if (!req.activeShift) {
            console.warn('[CASH MOVEMENT] No active shift found for user:', req.user?.id);
            return res.status(403).json({ success: false, message: 'No active shift found.' });
        }

        const shiftId = parseInt(req.activeShift.id);
        const employeeId = parseInt(req.user?.id);

        if (!shiftId || !employeeId) {
            console.error('[CASH MOVEMENT] Missing context:', { shiftId, employeeId });
            return res.status(500).json({ success: false, message: 'Internal Error: Missing context (shift/user)' });
        }

        console.log(`[CASH MOVEMENT] Creating movement for Shift=${shiftId}, Emp=${employeeId}`);

        // Create movement
        const movement = await req.prisma.cashMovement.create({
            data: {
                type,
                amount: parseFloat(amount),
                reason,
                notes: notes || '',
                shiftId,
                employeeId
            },
            include: {
                employee: {
                    select: { firstName: true, lastName: true }
                }
            }
        });

        // Audit Log
        if (req.prisma.auditLog) {
            await req.prisma.auditLog.create({
                data: {
                    action: 'CASH_MOVEMENT_CREATED',
                    entityType: 'CashMovement',
                    entityId: movement.id.toString(),
                    performedBy: employeeId,
                    metadata: JSON.stringify({ type, amount, reason, shiftId })
                }
            });
        }

        console.log(`[CASH MOVEMENT] Success: ID=${movement.id}`);

        res.json({
            success: true,
            message: 'Cash movement recorded successfully',
            data: movement
        });

    } catch (error) {
        console.error('[CASH MOVEMENT] FATAL ERROR:', error);
        // Better error message for Prisma validation errors
        if (error.code === 'P2003') {
            return res.status(400).json({ success: false, message: 'Invalid reference (shift or user).' });
        }
        res.status(500).json({ success: false, message: 'Failed to record cash movement: ' + error.message });
    }
});

/**
 * GET /api/cash-movements
 * List cash movements with filters
 */
router.get('/', async (req, res) => {
    try {
        const { shiftId, startDate, endDate, type, employeeId } = req.query;

        const where = {};

        // Filters
        if (shiftId) where.shiftId = parseInt(shiftId);
        if (type) where.type = type;
        if (employeeId) where.employeeId = parseInt(employeeId);

        if (startDate && endDate) {
            // Ensure end date covers the entire day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.createdAt = {
                gte: new Date(startDate),
                lte: end
            };
        }

        const movements = await req.prisma.cashMovement.findMany({
            where,
            include: {
                employee: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Calculate totals if filtering by shift
        let totals = null;
        if (shiftId) {
            const payIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.amount, 0);
            const payOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.amount, 0);
            totals = { payIn, payOut, net: payIn - payOut };
        }

        res.json({
            success: true,
            data: movements,
            totals
        });
    } catch (error) {
        console.error('List cash movements error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch cash movements' });
    }
});

module.exports = router;
