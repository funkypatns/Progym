const express = require('express');
const router = express.Router();
const AppointmentService = require('../services/appointmentService');
const { authenticate } = require('../middleware/auth');
const { parseDateRange } = require('../utils/dateParams');
const { roundMoney } = require('../utils/money');
const isDev = process.env.NODE_ENV !== 'production';

// Create
router.post('/', authenticate, async (req, res) => {
    try {
        const { start } = req.body;
        if (!start) {
            throw new Error('Missing appointment start time');
        }
        const requestedStart = new Date(start);
        if (isNaN(requestedStart.getTime())) {
            throw new Error('Invalid date format');
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (requestedStart < today) {
            const headerLang = (req.headers['accept-language'] || req.user?.language || '').toLowerCase();
            const isArabic = headerLang.startsWith('ar');
            const message = isArabic ? 'لا يمكن إضافة حجز في تاريخ سابق.' : "You can't create a booking in a past date.";
            return res.status(400).json({ success: false, message });
        }

        const payload = {
            ...req.body,
            coachId: req.user?.id,
            createdByEmployeeId: req.user?.id
        };
        const appointment = await AppointmentService.createAppointment(payload);
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
            arabicMessage: error.arabicMessage
        });
    }
});

// List
router.get('/', authenticate, async (req, res) => {
    try {
        const appointments = await AppointmentService.getAppointments(req.query);
        const normalized = Array.isArray(appointments) ? appointments : [appointments];
        res.json({ success: true, data: normalized });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
            arabicMessage: error.arabicMessage
        });
    }
});

// Pending Completion
router.get('/pending-completion', authenticate, async (req, res) => {
    try {
        const { startDate: startDateParam, endDate: endDateParam } = req.query;
        const where = {
            isCompleted: false,
            completedAt: null,
            status: { notIn: ['cancelled', 'no_show', 'completed'] }
        };
        if (startDateParam || endDateParam) {
            const { startDate, endDate, error } = parseDateRange(startDateParam || endDateParam, endDateParam || startDateParam);
            if (!error && startDate && endDate) {
                where.start = { gte: startDate };
                where.end = { lte: endDate };
            }
        }
        const appointments = await req.prisma.appointment.findMany({
            where,
            select: {
                id: true,
                title: true,
                start: true,
                end: true,
                status: true,
                price: true,
                paidAmount: true,
                paymentStatus: true,
                trainerId: true,
                memberId: true,
                coachId: true,
                createdByEmployeeId: true,
                isCompleted: true,
                member: { select: { firstName: true, lastName: true, memberId: true, phone: true } },
                coach: { select: { firstName: true, lastName: true } },
                trainer: { select: { id: true, name: true } },
                createdByEmployee: { select: { id: true, firstName: true, lastName: true } }
            },
            orderBy: { end: 'asc' }
        });
        return res.json({ success: true, data: appointments || [] });
    } catch (error) {
        console.error('[APPOINTMENTS] Pending completion error:', error);
        return res.json({ success: true, data: [], error: 'pending_completion_query_failed' });
    }
});

// Update
router.put('/:id', authenticate, async (req, res) => {
    try {
        const payload = {
            ...req.body,
            coachId: req.user?.id
        };
        const appointment = await AppointmentService.updateAppointment(req.params.id, payload);
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Complete (Transactional)
router.post('/:id/complete', authenticate, async (req, res) => {
    try {
        const { payment, sessionPrice, commissionPercent, paymentMethod } = req.body || {};
        const rawSessionPrice = sessionPrice ?? payment?.sessionPrice;
        const parsedSessionPrice = Number(rawSessionPrice);
        const rawCommission = commissionPercent ?? payment?.commissionPercent;
        const parsedCommission = rawCommission !== undefined && rawCommission !== null && rawCommission !== ''
            ? Number(rawCommission)
            : undefined;
        const paymentPayload = payment
            ? {
                ...payment,
                sessionPrice: Number.isFinite(parsedSessionPrice) ? parsedSessionPrice : undefined,
                commissionPercent: Number.isFinite(parsedCommission) ? parsedCommission : undefined
            }
            : {
                sessionPrice: Number.isFinite(parsedSessionPrice) ? parsedSessionPrice : undefined,
                commissionPercent: Number.isFinite(parsedCommission) ? parsedCommission : undefined
            };
        if (paymentMethod && !paymentPayload.method) {
            paymentPayload.method = paymentMethod;
        }
        const result = await AppointmentService.completeAppointment(req.params.id, paymentPayload, req.user);
        const appointment = result?.appointment ?? result;
        const sessionPayment = result?.sessionPayment ?? null;
        const trainer = result?.trainer ?? null;
        const alreadyCompleted = Boolean(result?.alreadyCompleted);
        res.json({ success: true, ok: true, appointment, sessionPayment, trainer, alreadyCompleted });
    } catch (error) {
        if (error?.code === 'SESSION_PRICE_INVALID' || error?.message === 'Session price must be greater than 0') {
            return res.status(400).json({
                success: false,
                ok: false,
                reason: 'VALIDATION_ERROR',
                message_ar: 'سعر الجلسة يجب أن يكون أكبر من صفر',
                message_en: 'Session price must be greater than 0'
            });
        }
        if (error?.code === 'COMMISSION_PERCENT_INVALID') {
            return res.status(400).json({
                success: false,
                ok: false,
                reason: 'VALIDATION_ERROR',
                message_ar: 'نسبة العمولة يجب أن تكون بين 0 و 100',
                message_en: 'Commission percent must be between 0 and 100'
            });
        }
        if (error?.code === 'P2002') {
            return res.status(409).json({
                ok: false,
                reason: 'CONFLICT',
                message: 'Duplicate session payment detected'
            });
        }
        // Handle missing coach/trainer errors
        if (error?.message?.includes('no longer exists') || error?.message?.includes('not found')) {
            return res.status(400).json({
                success: false,
                ok: false,
                reason: 'VALIDATION_ERROR',
                message_ar: 'المدرب المحدد غير موجود في النظام',
                message_en: error.message || 'Coach or trainer not found'
            });
        }
        // Handle foreign key constraint failures (P2003)
        if (error?.code === 'P2003') {
            console.error('Foreign key constraint failed:', error?.meta);
            return res.status(400).json({
                success: false,
                ok: false,
                reason: 'VALIDATION_ERROR',
                message_ar: 'بيانات مفقودة أو غير صحيحة',
                message_en: 'Referenced data not found (invalid foreign key)'
            });
        }
        console.error('Complete appointment error:', {
            message: error?.message,
            code: error?.code,
            name: error?.name,
            meta: error?.meta,
            stack: error?.stack
        });
        res.status(500).json({
            success: false,
            ok: false,
            reason: 'SERVER_ERROR',
            message: 'Failed to complete session',
            ...(isDev ? {
                debug: {
                    name: error?.name,
                    code: error?.code,
                    message: error?.message,
                    meta: error?.meta
                }
            } : {})
        });
    }
});

// Adjust final price after completion
router.patch('/:id/adjust-price', authenticate, async (req, res) => {
    try {
        const { newFinalPrice, finalPrice, reason } = req.body || {};
        const result = await AppointmentService.adjustAppointmentPrice(
            req.params.id,
            { newFinalPrice: newFinalPrice ?? finalPrice, reason },
            req.user
        );
        return res.json({ success: true, data: result });
    } catch (error) {
        const status = error.status || 400;
        return res.status(status).json({
            success: false,
            message: error.message || 'Failed to adjust price'
        });
    }
});

\n// Price adjustment history\nrouter.get('/:id/price-adjustments', authenticate, async (req, res) => {\n    try {\n        const id = parseInt(req.params.id);\n        if (Number.isNaN(id)) return res.json({ success: true, data: [] });\n        const rows = await req.prisma.sessionPriceAdjustment.findMany({\n            where: { appointmentId: id },\n            orderBy: { createdAt: 'desc' },\n            include: {\n                changedBy: { select: { firstName: true, lastName: true, username: true, email: true } }\n            }\n        });\n        return res.json({ success: true, data: rows });\n    } catch (error) {\n        console.error('Price adjustments history error', error);\n        return res.json({ success: true, data: [] });\n    }\n});\n\n// Quick Settle
router.post('/:id/settle', authenticate, async (req, res) => {
    try {
        const CommissionService = require('../services/commissionService');
        const result = await CommissionService.settleSingleAppointment(req.params.id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Preview Completion (Financials)
router.get('/:id/preview-completion', authenticate, async (req, res) => {
    try {
        const CommissionService = require('../services/commissionService');
        const appointment = await req.prisma.appointment.findUnique({
            where: { id: parseInt(req.params.id) },
            select: {
                trainerId: true,
                title: true,
                trainer: { select: { commissionPercent: true, name: true } }
            }
        });
        const rawTrainerId = req.query.trainerId;
        const trainerId = rawTrainerId !== undefined && rawTrainerId !== null && rawTrainerId !== ''
            ? Number(rawTrainerId)
            : null;
        let trainerOverride = null;
        if (Number.isFinite(trainerId) && trainerId > 0 && trainerId !== appointment?.trainerId) {
            trainerOverride = await req.prisma.staffTrainer.findUnique({
                where: { id: trainerId },
                select: { commissionPercent: true, name: true }
            });
        }
        const rawSessionPrice = req.query.sessionPrice;
        const sessionPrice = rawSessionPrice !== undefined && rawSessionPrice !== null && rawSessionPrice !== ''
            ? Number(rawSessionPrice)
            : undefined;
        const rawCommissionPercent = req.query.commissionPercent;
        const commissionPercent = rawCommissionPercent !== undefined && rawCommissionPercent !== null && rawCommissionPercent !== ''
            ? Number(rawCommissionPercent)
            : undefined;
        const hasCommissionOverride = Number.isFinite(commissionPercent)
            && commissionPercent >= 0
            && commissionPercent <= 100;
        const preview = await CommissionService.calculateCommissionPreview(req.params.id, req.prisma, {
            allowZero: true,
            sessionPrice: Number.isFinite(sessionPrice) ? sessionPrice : undefined
        });
        const trainerForPreview = trainerOverride || appointment?.trainer;
        const trainerPercentRaw = trainerForPreview?.commissionPercent;
        const trainerPercent = Number(trainerPercentRaw);
        const defaultCommissionPercent = await CommissionService.getDefaultSessionCommissionPercent(req.prisma);
        const resolvedCommissionPercent = hasCommissionOverride
            ? commissionPercent
            : (Number.isFinite(trainerPercent) && trainerPercent >= 0 && trainerPercent <= 100
                ? trainerPercent
                : defaultCommissionPercent);
        const priceValue = Number(preview?.sessionPrice || 0);
        const trainerPayout = roundMoney((priceValue * resolvedCommissionPercent) / 100);
        const gymShare = roundMoney(priceValue - trainerPayout);
        preview.commissionPercentUsed = resolvedCommissionPercent;
        preview.commissionValue = resolvedCommissionPercent;
        preview.commissionType = 'percentage';
        preview.trainerPayout = trainerPayout;
        preview.commissionAmount = trainerPayout;
        preview.gymShare = gymShare;
        preview.gymNetIncome = gymShare;
        preview.basisAmount = priceValue;
        const responseData = {
            ...preview,
            defaultCommissionPercent,
            trainerName: trainerForPreview?.name || preview?.coachName || '',
            serviceName: appointment?.title || ''
        };
        res.json({ success: true, data: responseData });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Delete/Cancel
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const appointment = await AppointmentService.deleteAppointment(req.params.id);
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Notifications for sessions (Auto-completed / Cancelled)
router.get('/notifications', authenticate, async (req, res) => {
    try {
        const type = req.query.type || 'auto_completed'; // or 'cancelled', 'no_show'
        const limit = parseInt(req.query.limit) || 50;

        const where = {};
        if (type === 'all') {
            where.status = { in: ['auto_completed', 'cancelled', 'no_show'] };
        } else {
            where.status = type;
        }

        const sessions = await req.prisma.appointment.findMany({
            where,
            include: {
                member: { select: { firstName: true, lastName: true } },
                coach: { select: { firstName: true, lastName: true } }
            },
            orderBy: { updatedAt: 'desc' }, // Show most recent changes
            take: limit
        });

        res.json({ success: true, data: sessions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Availability
router.get('/availability', authenticate, async (req, res) => {
    try {
        const { coachId, from, to } = req.query;
        if (!coachId || !from || !to) {
            return res.status(400).json({ success: false, message: 'Missing parameters' });
        }

        const booked = await req.prisma.appointment.findMany({
            where: {
                coachId: parseInt(coachId),
                status: { notIn: ['cancelled', 'no_show'] },
                start: { gte: new Date(from) },
                end: { lte: new Date(to) }
            },
            select: {
                start: true, // Return ISO strings
                end: true
            }
        });

        res.json({ success: true, data: booked });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;


