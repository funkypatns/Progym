/**
 * ============================================
 * POS ROUTES
 * ============================================
 * 
 * Endpoints for Machine & Shift Management.
 */

const express = require('express');
const router = express.Router();
const posService = require('../services/posService');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');

router.use(authenticate);

/**
 * GET /api/pos/status
 * Get machine status & current open shift
 */
router.get('/status', async (req, res) => {
    try {
        // Machine identification:
        // Client sends a machine identifier header or query param.
        // For now, we assume a single machine or identify by stored ID/Key.
        const { machineKey } = req.query;

        if (!machineKey) {
            return res.status(400).json({ success: false, message: 'Machine Key required' });
        }

        // Register/Get machine
        // Auto-register if new (simplified flow)
        const machine = await posService.registerMachine(machineKey);

        // Get status
        const status = await posService.getMachineStatus(machine.id);

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('POS status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/pos/shift/open
 * Open a new shift
 */
router.post('/shift/open', requirePermission(PERMISSIONS.POS_SHIFT_OPEN), async (req, res) => {
    try {
        const { machineId, openingCash } = req.body;

        if (!machineId || openingCash === undefined) {
            return res.status(400).json({ success: false, message: 'Missing parameters' });
        }

        const shift = await posService.openShift(machineId, req.user.id, openingCash);

        res.json({
            success: true,
            message: 'Shift opened successfully',
            data: shift
        });

    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/pos/shift/close
 * Close current shift
 */
router.post('/shift/close', requirePermission(PERMISSIONS.POS_SHIFT_CLOSE), async (req, res) => {
    try {
        const { shiftId, closingCash } = req.body;

        if (!shiftId || closingCash === undefined) {
            return res.status(400).json({ success: false, message: 'Missing parameters' });
        }

        const shift = await posService.closeShift(shiftId, req.user.id, closingCash);

        res.json({
            success: true,
            message: 'Shift closed successfully',
            data: shift
        });

    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pos/shift/:id/summary
 * Get totals for an open shift
 */
router.get('/shift/:id/summary', async (req, res) => {
    try {
        const { id } = req.params;
        const summary = await posService.getShiftSummary(id);

        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/pos/shifts
 * Get list of shifts (history)
 */
router.get('/shifts', async (req, res) => {
    try {
        const { startDate, endDate, employeeId, limit = 50 } = req.query;

        // RBAC: Only Admin can view shift history
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only Admins can view shift history.'
            });
        }

        const where = {
            status: 'closed'
        };

        if (startDate || endDate) {
            where.closedAt = {}; // Filter by when shift was CLOSED, not opened
            if (startDate) {
                const start = new Date(startDate);
                if (!isNaN(start.getTime())) {
                    start.setHours(0, 0, 0, 0);
                    where.closedAt.gte = start;
                }
            }
            if (endDate) {
                const end = new Date(endDate);
                if (!isNaN(end.getTime())) {
                    end.setHours(23, 59, 59, 999);
                    where.closedAt.lte = end;
                }
            }
        }

        if (employeeId && employeeId !== 'all') {
            where.closedBy = parseInt(employeeId); // Filter by who CLOSED the shift
        }

        const shifts = await req.prisma.pOSShift.findMany({
            where,
            orderBy: { closedAt: 'desc' }, // Order by close date
            take: parseInt(limit),
            include: {
                opener: {
                    select: { firstName: true, lastName: true }
                },
                closer: {
                    select: { firstName: true, lastName: true }
                },
                machine: {
                    select: { name: true }
                }
            }
        });

        res.json({
            success: true,
            data: shifts
        });
    } catch (error) {
        console.error('Fetch shifts error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch shifts' });
    }
});

module.exports = router;
