const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// All trainer payout routes require authentication
router.use(authenticate);

/**
 * POST /api/trainers/:id/payout
 * Pay out unpaid trainer earnings (StaffTrainer)
 */
router.post('/:id/payout', async (req, res) => {
    const trainerId = parseInt(req.params.id, 10);
    if (Number.isNaN(trainerId)) {
        return res.status(400).json({ success: false, message: 'Invalid trainer id' });
    }

    try {
        const methodRaw = typeof req.body.method === 'string' ? req.body.method.toUpperCase() : '';
        const method = methodRaw === 'TRANSFER' ? 'TRANSFER' : 'CASH';
        const note = typeof req.body.note === 'string' ? req.body.note.trim() : null;
        const earningIds = Array.isArray(req.body.earningIds)
            ? req.body.earningIds.map(id => parseInt(id, 10)).filter(id => !Number.isNaN(id))
            : null;
        const amount = req.body.amount !== undefined ? parseFloat(req.body.amount) : null;

        const result = await req.prisma.$transaction(async (tx) => {
            const trainer = await tx.staffTrainer.findUnique({ where: { id: trainerId } });
            if (!trainer) {
                const error = new Error('Trainer not found');
                error.status = 404;
                throw error;
            }

            const where = { trainerId, status: 'UNPAID' };
            if (earningIds && earningIds.length > 0) {
                where.id = { in: earningIds };
            }

            const earnings = await tx.trainerEarning.findMany({ where });
            if (earningIds && earnings.length !== earningIds.length) {
                const error = new Error('Some earnings are already paid or missing');
                error.status = 400;
                throw error;
            }
            if (!earnings.length) {
                const error = new Error('No unpaid earnings');
                error.status = 400;
                throw error;
            }

            const totalAmount = earnings.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
            if (amount !== null && !Number.isNaN(amount) && amount > totalAmount) {
                const error = new Error('Payout amount exceeds pending total');
                error.status = 400;
                throw error;
            }
            if (amount !== null && !Number.isNaN(amount) && Math.abs(amount - totalAmount) > 0.01) {
                const error = new Error('Payout amount must match selected earnings total');
                error.status = 400;
                throw error;
            }

            const payout = await tx.trainerPayout.create({
                data: {
                    trainerId,
                    totalAmount,
                    method,
                    note,
                    paidByEmployeeId: req.user?.id ?? null
                }
            });

            await tx.trainerEarning.updateMany({
                where: { id: { in: earnings.map(item => item.id) } },
                data: { status: 'PAID', payoutId: payout.id }
            });

            return { payout, totalAmount, count: earnings.length };
        });

        return res.json({
            success: true,
            data: {
                payoutId: result.payout.id,
                totalAmount: result.totalAmount,
                count: result.count
            }
        });
    } catch (error) {
        console.error('[TRAINERS] Payout error:', error);
        return res.status(error.status || 400).json({
            success: false,
            message: error.message || 'Failed to create payout'
        });
    }
});

module.exports = router;
