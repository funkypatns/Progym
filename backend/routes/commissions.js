const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { parseDateRange } = require('../utils/dateParams');

router.use(authenticate);

const normalizeMethod = (method) => {
    const raw = String(method || 'cash').trim().toLowerCase();
    if (raw === 'card') return 'CARD';
    if (raw === 'transfer' || raw === 'bank_transfer') return 'TRANSFER';
    return 'CASH';
};

const normalizeStatus = (status) => {
    const raw = String(status || '').trim().toUpperCase();
    if (raw === 'SETTLED' || raw === 'PAID') return 'PAID';
    if (raw === 'UNSETTLED' || raw === 'UNPAID') return 'UNPAID';
    return null;
};

const toMoney = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

const resolveRange = (query) => {
    const from = query.startDate || query.from || query.startAt;
    const to = query.endDate || query.to || query.endAt;
    const parsed = parseDateRange(from, to);
    if (parsed.error) return { error: parsed.error };
    return { startDate: parsed.startDate, endDate: parsed.endDate };
};

const resolveOptionalRange = (query) => {
    const from = query.startDate || query.from || query.startAt;
    const to = query.endDate || query.to || query.endAt;
    if (!from && !to) return { startDate: null, endDate: null };
    return resolveRange(query);
};

const buildCommissionWhere = (query, startDate, endDate) => {
    const where = {};
    const trainerId = parseInt(query.trainerId, 10);
    if (!Number.isNaN(trainerId)) where.trainerId = trainerId;

    const status = normalizeStatus(query.status);
    if (status) where.status = status;

    if (startDate && endDate) {
        where.createdAt = { gte: startDate, lte: endDate };
    }
    return where;
};

const toTransactionRow = (earning) => {
    const appointment = earning.appointment || null;
    const member = appointment?.member || null;
    const trainer = earning.trainer || null;
    const payout = earning.payout || null;
    const paidByEmployee = payout?.paidByEmployee || null;
    const serviceName = appointment?.title || appointment?.sessionName || 'PT Session';
    const originalPrice = Number(appointment?.price ?? earning.baseAmount ?? 0);
    const finalPrice = Number(appointment?.finalPrice ?? earning.baseAmount ?? originalPrice);
    const customerName = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();

    return {
        id: earning.id,
        trainerId: earning.trainerId,
        trainerName: trainer?.name || '',
        sourceType: 'SESSION',
        sourceId: earning.appointmentId,
        grossAmount: toMoney(earning.baseAmount ?? finalPrice),
        commissionAmount: toMoney(earning.commissionAmount),
        currency: 'EGP',
        occurredAt: earning.createdAt,
        status: earning.status === 'PAID' ? 'SETTLED' : 'UNSETTLED',
        settledAt: payout?.paidAt || null,
        settlementId: earning.payoutId || null,
        sessionDate: appointment?.end || appointment?.start || earning.createdAt,
        customerName: customerName || '',
        customerCode: member?.memberId || '',
        customerPhone: member?.phone || '',
        serviceName,
        employeeName: paidByEmployee ? [paidByEmployee.firstName, paidByEmployee.lastName].filter(Boolean).join(' ').trim() : '',
        appointmentStatus: appointment?.status || '',
        paymentStatus: appointment?.paymentStatus || '',
        originalPrice: toMoney(originalPrice),
        finalPrice: toMoney(finalPrice),
        commissionPercent: earning.commissionPercent ?? null,
        appointment: appointment ? {
            id: appointment.id,
            start: appointment.start,
            end: appointment.end,
            title: serviceName,
            price: appointment.price ?? null,
            finalPrice: appointment.finalPrice ?? null,
            status: appointment.status || '',
            paymentStatus: appointment.paymentStatus || '',
            payments: Array.isArray(appointment.payments) ? appointment.payments : []
        } : null
    };
};

/**
 * GET /api/commissions/summary
 * Query params: startDate,endDate,trainerId
 */
router.get('/summary', async (req, res) => {
    try {
        const { startDate, endDate, error } = resolveRange(req.query);
        if (error) return res.status(400).json({ success: false, message: error });

        const where = buildCommissionWhere(req.query, startDate, endDate);
        const rows = await req.prisma.trainerEarning.findMany({
            where,
            select: {
                id: true,
                baseAmount: true,
                commissionAmount: true,
                status: true
            }
        });

        const sessionsCount = rows.length;
        const grossTotal = toMoney(rows.reduce((sum, row) => sum + Number(row.baseAmount || 0), 0));
        const commissionTotal = toMoney(rows.reduce((sum, row) => sum + Number(row.commissionAmount || 0), 0));
        const settledTotal = toMoney(rows.reduce((sum, row) => sum + (row.status === 'PAID' ? Number(row.commissionAmount || 0) : 0), 0));
        const outstandingTotal = toMoney(rows.reduce((sum, row) => sum + (row.status !== 'PAID' ? Number(row.commissionAmount || 0) : 0), 0));

        return res.json({
            success: true,
            data: {
                sessions_count: sessionsCount,
                gross_total: grossTotal,
                commission_total: commissionTotal,
                settled_total: settledTotal,
                outstanding_total: outstandingTotal,
                sessionsCount,
                grossTotal,
                commissionTotal,
                settledTotal,
                outstandingTotal
            }
        });
    } catch (error) {
        console.error('[COMMISSIONS] Summary error:', error);
        return res.json({
            success: true,
            data: {
                sessions_count: 0,
                gross_total: 0,
                commission_total: 0,
                settled_total: 0,
                outstanding_total: 0,
                sessionsCount: 0,
                grossTotal: 0,
                commissionTotal: 0,
                settledTotal: 0,
                outstandingTotal: 0
            }
        });
    }
});

/**
 * GET /api/commissions/transactions
 * Query params: startDate,endDate,trainerId,status
 */
router.get('/transactions', async (req, res) => {
    try {
        const { startDate, endDate, error } = resolveRange(req.query);
        if (error) return res.status(400).json({ success: false, message: error });

        const where = buildCommissionWhere(req.query, startDate, endDate);
        const search = String(req.query.q || '').trim();
        const serviceId = parseInt(req.query.serviceId, 10);

        const appointmentWhere = {};
        if (search) {
            appointmentWhere.member = {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { memberId: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } }
                ]
            };
        }
        if (!Number.isNaN(serviceId)) {
            const service = await req.prisma.service.findUnique({ where: { id: serviceId } });
            if (service?.name) {
                appointmentWhere.title = { contains: service.name, mode: 'insensitive' };
            }
        }
        if (Object.keys(appointmentWhere).length > 0) {
            where.appointment = appointmentWhere;
        }

        const [earnings, settlements] = await Promise.all([
            req.prisma.trainerEarning.findMany({
                where,
                include: {
                    trainer: { select: { id: true, name: true } },
                    payout: {
                        select: {
                            id: true,
                            paidAt: true,
                            note: true,
                            method: true,
                            totalAmount: true,
                            paidByEmployee: { select: { id: true, firstName: true, lastName: true } }
                        }
                    },
                    appointment: {
                        select: {
                            id: true,
                            start: true,
                            end: true,
                            title: true,
                            sessionName: true,
                            price: true,
                            finalPrice: true,
                            status: true,
                            paymentStatus: true,
                            payments: {
                                select: {
                                    id: true,
                                    amount: true,
                                    method: true,
                                    status: true,
                                    paidAt: true
                                },
                                orderBy: { paidAt: 'desc' }
                            },
                            member: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    memberId: true,
                                    phone: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            req.prisma.trainerPayout.findMany({
                where: {
                    ...(where.trainerId ? { trainerId: where.trainerId } : {}),
                    ...(startDate && endDate ? { createdAt: { gte: startDate, lte: endDate } } : {})
                },
                include: {
                    trainer: { select: { id: true, name: true } },
                    paidByEmployee: { select: { id: true, firstName: true, lastName: true } }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        const rows = earnings.map(toTransactionRow);
        const settlementRows = settlements.map((item) => ({
            id: item.id,
            trainerId: item.trainerId,
            trainerName: item.trainer?.name || '',
            totalAmount: toMoney(item.totalAmount),
            method: item.method || 'CASH',
            note: item.note || '',
            paidAt: item.paidAt,
            createdAt: item.createdAt,
            paidByEmployee: item.paidByEmployee || null
        }));

        return res.json({
            success: true,
            data: {
                rows,
                settlements: settlementRows
            }
        });
    } catch (error) {
        console.error('[COMMISSIONS] Transactions error:', error);
        return res.json({ success: true, data: { rows: [], settlements: [] } });
    }
});

/**
 * POST /api/commissions/settle
 * payload: trainerId, amount | settleAll=true, method, note, dateRange(optional)
 */
router.post('/settle', async (req, res) => {
    const trainerId = parseInt(req.body?.trainerId, 10);
    if (Number.isNaN(trainerId)) {
        return res.status(400).json({ success: false, message: 'trainerId is required' });
    }

    const settleAll = Boolean(req.body?.settleAll);
    const requestedAmount = req.body?.amount !== undefined && req.body?.amount !== null
        ? Number(req.body.amount)
        : null;
    if (!settleAll && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
        return res.status(400).json({ success: false, message: 'amount must be greater than 0 when settleAll is false' });
    }

    const method = normalizeMethod(req.body?.method);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;

    const rangeInput = req.body?.dateRange || {};
    const range = resolveOptionalRange({
        startDate: rangeInput?.startDate || rangeInput?.from || req.body?.startDate || req.body?.from,
        endDate: rangeInput?.endDate || rangeInput?.to || req.body?.endDate || req.body?.to
    });
    if (range.error) return res.status(400).json({ success: false, message: range.error });

    try {
        const result = await req.prisma.$transaction(async (tx) => {
            const trainer = await tx.staffTrainer.findUnique({
                where: { id: trainerId },
                select: { id: true, name: true }
            });
            if (!trainer) {
                const error = new Error('Trainer not found');
                error.status = 404;
                throw error;
            }

            const unsettled = await tx.trainerEarning.findMany({
                where: {
                    trainerId,
                    status: 'UNPAID',
                    ...(range.startDate && range.endDate ? { createdAt: { gte: range.startDate, lte: range.endDate } } : {})
                },
                orderBy: { createdAt: 'asc' }
            });

            if (!unsettled.length) {
                const error = new Error('No unsettled commission transactions');
                error.status = 400;
                throw error;
            }

            let selected = unsettled;
            if (!settleAll) {
                let running = 0;
                selected = [];
                unsettled.forEach((item) => {
                    const commissionAmount = toMoney(item.commissionAmount);
                    if (commissionAmount <= 0) return;
                    if (running + commissionAmount <= requestedAmount + 0.0001) {
                        selected.push(item);
                        running = toMoney(running + commissionAmount);
                    }
                });
                if (!selected.length) {
                    const error = new Error('Amount is too low for available unsettled transactions');
                    error.status = 400;
                    throw error;
                }
            }

            const totalAmount = toMoney(selected.reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0));
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
                where: { id: { in: selected.map((item) => item.id) } },
                data: {
                    status: 'PAID',
                    payoutId: payout.id
                }
            });

            return {
                trainer,
                payout,
                settledTransactions: selected.length,
                settledAmount: totalAmount
            };
        });

        return res.json({
            success: true,
            data: {
                settlementId: result.payout.id,
                trainerId: result.trainer.id,
                trainerName: result.trainer.name,
                settledTransactions: result.settledTransactions,
                settledAmount: result.settledAmount
            }
        });
    } catch (error) {
        console.error('[COMMISSIONS] Settle error:', error);
        return res.status(error.status || 400).json({
            success: false,
            message: error.message || 'Failed to settle commission transactions'
        });
    }
});

module.exports = router;
