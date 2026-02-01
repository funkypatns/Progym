const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// All staff trainer routes require authentication
router.use(authenticate);

/**
 * GET /api/staff-trainers
 * Return basic list of available trainers for dropdowns
 */
router.get('/', async (req, res) => {
  try {
    const trainers = await req.prisma.staffTrainer.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        commissionPercent: true,
        commissionType: true,
        commissionValue: true,
        internalSessionValue: true,
        active: true
      },
      orderBy: { id: 'desc' }
    });

    return res.json({ success: true, data: trainers });
  } catch (error) {
    console.error('[STAFF TRAINERS] Read error:', error);
    return res.json({ success: true, data: [] });
  }
});

const validateTrainer = (data) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new Error('Name is required');
  }
  if (data.commissionPercent !== undefined && (data.commissionPercent < 0 || data.commissionPercent > 100)) {
    throw new Error('commissionPercent must be between 0 and 100');
  }
};

router.post('/', async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      phone: req.body.phone || null,
      commissionPercent: req.body.commissionPercent ?? null,
      commissionType: req.body.commissionPercent !== undefined ? 'percentage' : 'percentage',
      commissionValue: req.body.commissionPercent ?? null,
      internalSessionValue: req.body.internalSessionValue ?? 0,
      active: req.body.active === undefined ? true : Boolean(req.body.active)
    };
    validateTrainer(payload);

    const trainer = await req.prisma.$transaction(async (tx) => {
      return tx.staffTrainer.create({ data: payload });
    });
    return res.json({ success: true, data: trainer });
  } catch (error) {
    console.error('[STAFF TRAINERS] Create error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.commissionPercent !== undefined) {
      updates.commissionPercent = req.body.commissionPercent;
      updates.commissionType = 'percentage';
      updates.commissionValue = req.body.commissionPercent;
    }
    if (req.body.active !== undefined) updates.active = Boolean(req.body.active);

    if (updates.name !== undefined) {
      validateTrainer(updates);
    }

    const trainer = await req.prisma.$transaction(async (tx) => {
      return tx.staffTrainer.update({
        where: { id: parseInt(req.params.id) },
        data: updates
      });
    });
    return res.json({ success: true, data: trainer });
  } catch (error) {
    console.error('[STAFF TRAINERS] Update error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    const trainer = await req.prisma.staffTrainer.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }
    const updated = await req.prisma.$transaction(async (tx) => {
      return tx.staffTrainer.update({
        where: { id: trainer.id },
        data: { active: !trainer.active }
      });
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[STAFF TRAINERS] Toggle error:', error);
    res.status(400).json({ success: false, message: 'Failed to toggle active state' });
  }
});

router.delete('/:id', async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Trainer deletion is disabled. Use Active/Inactive instead.'
  });
});

/**
 * GET /api/staff-trainers/:id/commission
 */
router.get('/:id/commission', async (req, res) => {
  try {
    const trainerId = parseInt(req.params.id);
    const trainer = await req.prisma.staffTrainer.findUnique({
      where: { id: trainerId },
      select: {
        commissionType: true,
        commissionValue: true,
        commissionPercent: true,
        internalSessionValue: true
      }
    });
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }
    const type = trainer.commissionType || (trainer.commissionPercent !== null ? 'percentage' : 'percentage');
    const value = trainer.commissionValue ?? trainer.commissionPercent ?? 0;
    const internalSessionValue = trainer.internalSessionValue ?? 0;
    return res.json({ success: true, data: { type, value, internalSessionValue } });
  } catch (error) {
    console.error('[STAFF TRAINERS] Commission read error:', error);
    return res.json({ success: true, data: { type: 'percentage', value: 0, internalSessionValue: 0 } });
  }
});

/**
 * POST /api/staff-trainers/:id/commission
 */
router.post('/:id/commission', async (req, res) => {
  try {
    const trainerId = parseInt(req.params.id);
    const type = req.body.type === 'fixed' ? 'fixed' : 'percentage';
    const value = typeof req.body.value === 'number' ? req.body.value : parseFloat(req.body.value || 0);
    const internalSessionValue = typeof req.body.internalSessionValue === 'number'
      ? req.body.internalSessionValue
      : parseFloat(req.body.internalSessionValue || 0);

    const trainer = await req.prisma.$transaction(async (tx) => {
      return tx.staffTrainer.update({
        where: { id: trainerId },
        data: {
          commissionType: type,
          commissionValue: value,
          internalSessionValue,
          commissionPercent: type === 'percentage' ? value : null
        }
      });
    });
    return res.json({
      success: true,
      data: {
        type: trainer.commissionType,
        value: trainer.commissionValue ?? trainer.commissionPercent ?? 0,
        internalSessionValue: trainer.internalSessionValue ?? 0
      }
    });
  } catch (error) {
    console.error('[STAFF TRAINERS] Commission update error:', error);
    return res.status(400).json({ success: false, message: 'Failed to update commission settings' });
  }
});

/**
 * GET /api/staff-trainers/:id/earnings
 * Returns computed earnings summary for the trainer.
 */
router.get('/:id/earnings', async (req, res) => {
  try {
    const trainerId = parseInt(req.params.id);
    if (Number.isNaN(trainerId)) {
      return res.json({ success: true, data: { summary: { sessionsCount: 0, totalEarnings: 0, pendingEarnings: 0, paidEarnings: 0 }, rows: [] } });
    }

    const trainer = await req.prisma.staffTrainer.findUnique({
      where: { id: trainerId },
      select: { commissionType: true, commissionValue: true, commissionPercent: true }
    });
    if (!trainer) {
      return res.json({ success: true, data: { summary: { sessionsCount: 0, totalEarnings: 0, pendingEarnings: 0, paidEarnings: 0 }, rows: [] } });
    }

    const startDate = req.query.startDate || req.query.from;
    const endDate = req.query.endDate || req.query.to;
    const where = {
      trainerId,
      status: { in: ['completed', 'auto_completed'] }
    };
    if (startDate && endDate) {
      where.start = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: {
        member: { select: { firstName: true, lastName: true } }
      },
      orderBy: { start: 'asc' }
    });

    const commissionType = trainer.commissionType || (trainer.commissionPercent !== null ? 'percentage' : 'percentage');
    const commissionValue = trainer.commissionValue ?? trainer.commissionPercent ?? 0;

    const rows = appointments.map(apt => {
      const basisAmount = apt.price || 0;
      const earningAmount = commissionType === 'fixed'
        ? commissionValue
        : (basisAmount * commissionValue) / 100;
      return {
        id: apt.id,
        date: (apt.completedAt || apt.end || apt.start),
        customerName: `${apt.member?.firstName || ''} ${apt.member?.lastName || ''}`.trim(),
        sourceRef: apt.title || 'Session',
        appointmentId: apt.id,
        basisAmount,
        ruleText: commissionType === 'fixed'
          ? `Fixed ${commissionValue}`
          : `${commissionValue}% of ${basisAmount || 0}`,
        earningAmount: Number(earningAmount.toFixed(2)),
        status: 'pending'
      };
    });

    const totalEarnings = rows.reduce((sum, r) => sum + (r.earningAmount || 0), 0);

    return res.json({
      success: true,
      data: {
        summary: {
          sessionsCount: rows.length,
          totalEarnings,
          pendingEarnings: totalEarnings,
          paidEarnings: 0
        },
        rows
      }
    });
  } catch (error) {
    console.error('[STAFF TRAINERS] Earnings error:', error);
    return res.json({ success: true, data: { summary: { sessionsCount: 0, totalEarnings: 0, pendingEarnings: 0, paidEarnings: 0 }, rows: [] } });
  }
});

module.exports = router;
