const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// All staff trainer routes require authentication
router.use(authenticate);

const DEFAULT_SESSION_COMMISSION_PERCENT = 20;
const getDefaultSessionCommissionPercent = async (prisma) => {
  const setting = await prisma.setting.findUnique({ where: { key: 'defaultSessionCommissionPercent' } });
  const raw = setting?.value;
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0 || num > 100) return DEFAULT_SESSION_COMMISSION_PERCENT;
  return num;
};

const resolveDateRange = (startDate, endDate) => {
  const defaultEnd = new Date();
  const defaultStart = new Date(defaultEnd.getFullYear(), defaultEnd.getMonth(), 1);
  defaultStart.setHours(0, 0, 0, 0);
  defaultEnd.setHours(23, 59, 59, 999);

  if (!startDate || !endDate) {
    return { start: defaultStart, end: defaultEnd };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { start: defaultStart, end: defaultEnd };
  }
  if (typeof startDate === 'string' && startDate.length <= 10) {
    start.setHours(0, 0, 0, 0);
  }
  if (typeof endDate === 'string' && endDate.length <= 10) {
    end.setHours(23, 59, 59, 999);
  }
  return { start, end };
};

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
  const trainerId = parseInt(req.params.id, 10);
  if (Number.isNaN(trainerId)) {
    return res.status(400).json({ success: false, message: 'Invalid trainer id' });
  }
  try {
    await req.prisma.$transaction(async (tx) => {
      const [appointmentsCount, earningsCount, paymentsCount, trainerEarningsCount, trainerPayoutsCount] = await Promise.all([
        tx.appointment.count({ where: { trainerId } }),
        tx.coachEarning.count({ where: { appointment: { trainerId } } }),
        tx.payment.count({ where: { appointment: { trainerId } } }),
        tx.trainerEarning.count({ where: { trainerId } }),
        tx.trainerPayout.count({ where: { trainerId } })
      ]);
      if (appointmentsCount > 0 || earningsCount > 0 || paymentsCount > 0 || trainerEarningsCount > 0 || trainerPayoutsCount > 0) {
        const error = new Error('لا يمكن حذف المدرب لوجود بيانات مرتبطة به');
        error.status = 400;
        throw error;
      }
      await tx.staffTrainer.delete({ where: { id: trainerId } });
    });
    return res.json({ success: true });
  } catch (error) {
    console.error('[STAFF TRAINERS] Delete error:', error);
    return res.status(error.status || 400).json({
      success: false,
      message: error.message || 'Failed to delete trainer'
    });
  }
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
      return res.json({ success: true, data: { trainer: null, totals: { unpaidAmount: 0, unpaidCount: 0, paidAmount: 0, paidCount: 0 }, earnings: [] } });
    }

    const trainer = await req.prisma.staffTrainer.findUnique({
      where: { id: trainerId },
      select: { id: true, name: true }
    });
    if (!trainer) {
      return res.json({ success: true, data: { trainer: null, totals: { unpaidAmount: 0, unpaidCount: 0, paidAmount: 0, paidCount: 0 }, earnings: [] } });
    }

    const statusParam = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null;
    const startDate = req.query.startDate || req.query.from;
    const endDate = req.query.endDate || req.query.to;
    const where = { trainerId };
    if (statusParam === 'PAID' || statusParam === 'UNPAID') {
      where.status = statusParam;
    }
    const range = resolveDateRange(startDate, endDate);
    where.appointment = {
      start: {
        gte: range.start,
        lte: range.end
      }
    };

    const earnings = await req.prisma.trainerEarning.findMany({
      where,
      include: {
        appointment: {
          select: {
            id: true,
            title: true,
            price: true,
            finalPrice: true,
            paidAmount: true,
            dueAmount: true,
            overpaidAmount: true,
            paymentStatus: true,
            start: true,
            end: true,
            member: { select: { firstName: true, lastName: true, memberId: true } },
            trainer: { select: { id: true, name: true, commissionPercent: true } },
            completedByEmployee: { select: { firstName: true, lastName: true } },
            priceAdjustments: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                changedBy: { select: { firstName: true, lastName: true, username: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const defaultCommissionPercent = await getDefaultSessionCommissionPercent(req.prisma);

    const mapped = earnings.map(item => {
      const memberName = `${item.appointment?.member?.firstName || ''} ${item.appointment?.member?.lastName || ''}`.trim();
      const employeeName = item.appointment?.completedByEmployee
        ? `${item.appointment.completedByEmployee.firstName || ''} ${item.appointment.completedByEmployee.lastName || ''}`.trim()
        : '';

      const originalPrice = item.appointment?.price ?? 0;
      const finalPrice = item.appointment?.finalPrice ?? originalPrice;
      const effectivePrice = finalPrice ?? item.baseAmount ?? originalPrice ?? 0;
      const adjustment = item.appointment?.priceAdjustments?.[0] || null;
      const adjustmentDifference = Number(finalPrice || 0) - Number(originalPrice || 0);
      const adjustedBy = adjustment?.changedBy
        ? [adjustment.changedBy.firstName, adjustment.changedBy.lastName].filter(Boolean).join(' ').trim()
          || adjustment.changedBy.username || ''
        : '';
      const commissionPercentUsed = item.commissionPercent !== null && item.commissionPercent !== undefined
        ? item.commissionPercent
        : (item.appointment?.trainer?.commissionPercent ?? defaultCommissionPercent);
      const commissionAmount = item.commissionAmount !== null && item.commissionAmount !== undefined
        ? item.commissionAmount
        : Number(((effectivePrice * (commissionPercentUsed || 0)) / 100).toFixed(2));

      const basisAmount = effectivePrice;
      const ruleText = `${commissionPercentUsed ?? 0}% of ${basisAmount || 0}`;
      const dateValue = item.appointment?.end || item.appointment?.start || item.createdAt;
      const date = dateValue instanceof Date ? dateValue.toISOString() : dateValue;

      const dueAmount = item.appointment?.dueAmount ?? Math.max(0, effectivePrice - (item.appointment?.paidAmount ?? 0));
      const overpaidAmount = item.appointment?.overpaidAmount ?? Math.max(0, (item.appointment?.paidAmount ?? 0) - effectivePrice);
      const paymentStatus = item.appointment?.paymentStatus || (dueAmount > 0 ? 'DUE' : (overpaidAmount > 0 ? 'OVERPAID' : 'PAID'));

      return {
        id: item.id,
        appointmentId: item.appointmentId,
        date,
        customerName: memberName,
        customerCode: item.appointment?.member?.memberId || '',
        sourceRef: item.appointment?.title || 'Session',
        basisAmount,
        ruleText,
        earningAmount: Number(commissionAmount || 0),
        commissionPercent: commissionPercentUsed ?? null,
        status: item.status === 'PAID' ? 'paid' : 'pending',
        employeeName,
        paymentStatus,
        dueAmount,
        overpaidAmount,
        originalPrice,
        finalPrice,
        adjustmentDifference,
        adjustmentReason: adjustment?.reason || '',
        adjustedBy,
        adjustedAt: adjustment?.createdAt || null
      };
    });

    const unpaid = earnings.filter(item => item.status === 'UNPAID');
    const paid = earnings.filter(item => item.status === 'PAID');
    const totals = {
      unpaidAmount: unpaid.reduce((sum, item) => sum + (item.commissionAmount || 0), 0),
      unpaidCount: unpaid.length,
      paidAmount: paid.reduce((sum, item) => sum + (item.commissionAmount || 0), 0),
      paidCount: paid.length
    };

    if (process.env.DEBUG_REPORTS === '1') {
      console.log('[REPORTS][STAFF TRAINERS] earnings', {
        trainerId,
        startDate,
        endDate,
        count: mapped.length
      });
    }

    return res.json({
      success: true,
      data: {
        trainer,
        totals,
        earnings: mapped,
        summary: {
          sessionsCount: mapped.length,
          totalEarnings: totals.unpaidAmount + totals.paidAmount,
          pendingEarnings: totals.unpaidAmount,
          paidEarnings: totals.paidAmount
        }
      }
    });
  } catch (error) {
    console.error('[STAFF TRAINERS] Earnings error:', error);
    return res.json({ success: true, data: { trainer: null, totals: { unpaidAmount: 0, unpaidCount: 0, paidAmount: 0, paidCount: 0 }, earnings: [] } });
  }
});

/**
 * POST /api/staff-trainers/:id/payout
 * Pay out unpaid trainer earnings
 */
router.post('/:id/payout', async (req, res) => {
  const trainerId = parseInt(req.params.id);
  if (Number.isNaN(trainerId)) {
    return res.status(400).json({ success: false, message: 'Invalid trainer id' });
  }
  try {
    const methodRaw = typeof req.body.method === 'string' ? req.body.method.toUpperCase() : '';
    const method = methodRaw === 'TRANSFER' ? 'TRANSFER' : 'CASH';
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : null;
    const earningIds = Array.isArray(req.body.earningIds)
      ? req.body.earningIds.map(id => parseInt(id)).filter(id => !Number.isNaN(id))
      : null;

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
    console.error('[STAFF TRAINERS] Payout error:', error);
    return res.status(error.status || 400).json({
      success: false,
      message: error.message || 'Failed to create payout'
    });
  }
});

/**
 * GET /api/staff-trainers/:id/payouts
 */
router.get('/:id/payouts', async (req, res) => {
  try {
    const trainerId = parseInt(req.params.id);
    if (Number.isNaN(trainerId)) {
      return res.json({ success: true, data: [] });
    }

    const where = { trainerId };
    const startDate = req.query.startDate || req.query.from;
    const endDate = req.query.endDate || req.query.to;
    const range = resolveDateRange(startDate, endDate);
    where.paidAt = { gte: range.start, lte: range.end };

    const payouts = await req.prisma.trainerPayout.findMany({
      where,
      include: {
        paidByEmployee: { select: { firstName: true, lastName: true } },
        trainer: { select: { id: true, name: true } }
      },
      orderBy: { paidAt: 'desc' }
    });

    return res.json({ success: true, data: payouts || [] });
  } catch (error) {
    console.error('[STAFF TRAINERS] Payouts fetch error:', error);
    return res.json({ success: true, data: [] });
  }
});

module.exports = router;
