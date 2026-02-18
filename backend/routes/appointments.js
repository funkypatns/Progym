const express = require('express');
const router = express.Router();
const AppointmentService = require('../services/appointmentService');
const { authenticate, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../utils/permissions');
const { parseDateRange } = require('../utils/dateParams');
const { roundMoney } = require('../utils/money');
const CreditService = require('../services/creditService');
const { addTableSheet, createWorkbook, sendWorkbook, toDateStamp } = require('../services/excelExportService');
const isDev = process.env.NODE_ENV !== 'production';

// Create
router.post('/', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
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
router.get('/', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_VIEW), async (req, res) => {
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
router.get('/pending-completion', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_VIEW), async (req, res) => {
    try {
        const {
            startDate: startDateParam,
            endDate: endDateParam,
            trainerId,
            employeeId,
            serviceId,
            search,
            format
        } = req.query;
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
        const parsedTrainerId = parseInt(trainerId, 10);
        if (trainerId && trainerId !== 'all' && !Number.isNaN(parsedTrainerId)) {
            where.trainerId = parsedTrainerId;
        }
        const parsedEmployeeId = parseInt(employeeId, 10);
        if (employeeId && employeeId !== 'all' && !Number.isNaN(parsedEmployeeId)) {
            where.createdByEmployeeId = parsedEmployeeId;
        }
        if (serviceId && serviceId !== 'all') {
            const parsedServiceId = parseInt(serviceId, 10);
            if (!Number.isNaN(parsedServiceId)) {
                const service = await req.prisma.service.findUnique({
                    where: { id: parsedServiceId },
                    select: { name: true }
                });
                if (service?.name) {
                    where.title = { contains: service.name, mode: 'insensitive' };
                }
            }
        }
        if (search && String(search).trim()) {
            const q = String(search).trim();
            where.OR = [
                { fullName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                {
                    member: {
                        OR: [
                            { firstName: { contains: q, mode: 'insensitive' } },
                            { lastName: { contains: q, mode: 'insensitive' } },
                            { memberId: { contains: q, mode: 'insensitive' } },
                            { phone: { contains: q } }
                        ]
                    }
                }
            ];
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
                fullName: true,
                phone: true,
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

        if (String(format || '').toLowerCase() === 'excel') {
            const rows = (appointments || []).map((appointment) => {
                const member = appointment.member || {};
                const customerName = `${member.firstName || ''} ${member.lastName || ''}`.trim();
                const trainerName = appointment.trainer?.name
                    || `${appointment.coach?.firstName || ''} ${appointment.coach?.lastName || ''}`.trim();
                const employeeName = appointment.createdByEmployee
                    ? `${appointment.createdByEmployee.firstName || ''} ${appointment.createdByEmployee.lastName || ''}`.trim()
                    : '';

                return {
                    customer: member.memberId ? `${customerName} (${member.memberId})` : customerName,
                    date: appointment.start || null,
                    start: appointment.start || null,
                    end: appointment.end || null,
                    trainer: trainerName || '',
                    employee: employeeName || '',
                    price: appointment.price ?? 0,
                    status: appointment.status || ''
                };
            });

            const workbook = createWorkbook();
            addTableSheet(workbook, {
                name: 'Pending Completion',
                title: 'Pending Completion Report',
                subtitle: `${toDateStamp()} (${rows.length})`,
                columns: [
                    { key: 'customer', header: 'Customer', type: 'text' },
                    { key: 'date', header: 'Date', type: 'date' },
                    { key: 'start', header: 'Start', type: 'date' },
                    { key: 'end', header: 'End', type: 'date' },
                    { key: 'trainer', header: 'Trainer', type: 'text' },
                    { key: 'employee', header: 'Employee', type: 'text' },
                    { key: 'price', header: 'Price', type: 'currency' },
                    { key: 'status', header: 'Status', type: 'text' }
                ],
                rows
            });
            return sendWorkbook(res, workbook, `pending-completion-${toDateStamp()}.xlsx`);
        }

        return res.json({ success: true, data: appointments || [] });
    } catch (error) {
        console.error('[APPOINTMENTS] Pending completion error:', error);
        return res.json({ success: true, data: [], error: 'pending_completion_query_failed' });
    }
});

// Update
router.put('/:id', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
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

// Quick Status Update
router.patch('/:id/status', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
    try {
        const updated = await AppointmentService.updateAppointmentStatus(req.params.id, req.body?.status, {
            notes: req.body?.notes
        });
        return res.json({ success: true, data: updated });
    } catch (error) {
        const statusCode = error.status || 400;
        return res.status(statusCode).json({
            success: false,
            reason: statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
            message: error.message || 'Failed to update status'
        });
    }
});

// Complete (Transactional)
router.post('/:id/complete', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
    try {
        const { payment, sessionPrice, commissionPercent, paymentMethod, memberDetails, paymentStatus, amount } = req.body || {};
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
                commissionPercent: Number.isFinite(parsedCommission) ? parsedCommission : undefined,
                memberDetails,
                paymentStatus
            }
            : {
                sessionPrice: Number.isFinite(parsedSessionPrice) ? parsedSessionPrice : undefined,
                commissionPercent: Number.isFinite(parsedCommission) ? parsedCommission : undefined,
                memberDetails,
                paymentStatus,
                amount
            };
        if (paymentMethod && !paymentPayload.method) {
            paymentPayload.method = paymentMethod;
        }
        const result = await AppointmentService.completeAppointment(req.params.id, paymentPayload, req.user);
        const appointment = result?.appointment ?? result;
        const sessionPayment = result?.sessionPayment ?? null;
        const trainer = result?.trainer ?? null;
        const member = result?.member ?? null;
        const alreadyCompleted = Boolean(result?.alreadyCompleted);
        res.json({
            success: true,
            ok: true,
            appointment,
            sessionPayment,
            trainer,
            member,
            alreadyCompleted,
            appliedCredit: result?.appliedCredit ?? 0,
            dueAmount: result?.dueAmount ?? appointment?.dueAmount,
            overpaidAmount: result?.overpaidAmount ?? appointment?.overpaidAmount
        });
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
        if (error?.reason === 'PHONE_EXISTS') {
            return res.status(409).json({
                success: false,
                ok: false,
                reason: 'PHONE_EXISTS',
                message: error.message || 'رقم الهاتف مسجل بالفعل.'
            });
        }
        if (error?.status === 400 || error?.status === 404 || error?.status === 409) {
            return res.status(error.status).json({
                success: false,
                ok: false,
                reason: error.reason || (error.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST'),
                message: error.message || 'Failed to complete session'
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
router.patch('/:id/adjust-price', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
    try {
        const { newFinalPrice, finalPrice, reason } = req.body || {};
        const result = await AppointmentService.adjustAppointmentPrice(
            req.params.id,
            { newFinalPrice: newFinalPrice ?? finalPrice, reason, newPrice: req.body?.newPrice },
            req.user
        );
        return res.json({ success: true, data: result });
    } catch (error) {
        const status = error.status || 400;
        const reason =
            status === 404 ? 'NOT_FOUND' :
            status === 409 ? 'CONFLICT' :
            'BAD_REQUEST';
        return res.status(status).json({
            success: false,
            reason,
            message: error.message || 'Failed to adjust price'
        });
    }
});

// Price adjustment history
router.get('/:id/price-adjustments', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_VIEW), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (Number.isNaN(id)) return res.json({ success: true, data: [] });
        const rows = await req.prisma.sessionPriceAdjustment.findMany({
            where: { appointmentId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                changedBy: { select: { firstName: true, lastName: true, username: true, email: true } }
            }
        });
        return res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Price adjustments history error', error);
        return res.json({ success: true, data: [] });
    }
});

// Quick Settle
router.post('/:id/settle', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
    try {
        const CommissionService = require('../services/commissionService');
        const result = await CommissionService.settleSingleAppointment(req.params.id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Preview Completion (Financials)
router.get('/:id/preview-completion', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_VIEW), async (req, res) => {
    try {
        const CommissionService = require('../services/commissionService');
        const appointmentId = Number(req.params.id);
        if (!Number.isInteger(appointmentId)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST' });
        }
        const rawTrainerId = req.query.trainerId;
        const trainerId = rawTrainerId !== undefined && rawTrainerId !== null && rawTrainerId !== ''
            ? Number(rawTrainerId)
            : null;
        if (rawTrainerId !== undefined && rawTrainerId !== null && rawTrainerId !== '' && !Number.isFinite(trainerId)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST' });
        }
        const rawSessionPrice = req.query.sessionPrice;
        const sessionPrice = rawSessionPrice !== undefined && rawSessionPrice !== null && rawSessionPrice !== ''
            ? Number(rawSessionPrice)
            : undefined;
        if (rawSessionPrice !== undefined && rawSessionPrice !== null && rawSessionPrice !== '' && !Number.isFinite(sessionPrice)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST' });
        }
        const appointment = await req.prisma.appointment.findUnique({
            where: { id: appointmentId },
            select: {
                id: true,
                memberId: true,
                coachId: true,
                trainerId: true,
                title: true,
                price: true,
                finalPrice: true,
                paidAmount: true,
                paymentStatus: true,
                trainer: { select: { id: true, name: true, commissionPercent: true } }
            }
        });
        if (!appointment) {
            return res.status(404).json({ success: false, reason: 'NOT_FOUND' });
        }
        let trainerOverride = null;
        if (Number.isFinite(trainerId) && trainerId > 0 && trainerId !== appointment.trainerId) {
            trainerOverride = await req.prisma.staffTrainer.findUnique({
                where: { id: trainerId },
                select: { commissionPercent: true, name: true }
            });
        }
        const rawCommissionPercent = req.query.commissionPercent;
        const commissionPercent = rawCommissionPercent !== undefined && rawCommissionPercent !== null && rawCommissionPercent !== ''
            ? Number(rawCommissionPercent)
            : undefined;
        if (rawCommissionPercent !== undefined && rawCommissionPercent !== null && rawCommissionPercent !== '' && !Number.isFinite(commissionPercent)) {
            return res.status(400).json({ success: false, reason: 'BAD_REQUEST' });
        }
        const hasCommissionOverride = Number.isFinite(commissionPercent)
            && commissionPercent >= 0
            && commissionPercent <= 100;
        const hasFinalPrice = appointment.finalPrice !== null && appointment.finalPrice !== undefined
            && Number.isFinite(Number(appointment.finalPrice));
        const effectivePrice = Number.isFinite(sessionPrice)
            ? sessionPrice
            : (hasFinalPrice ? Number(appointment.finalPrice) : Number(appointment.price || 0));
        const preview = await CommissionService.calculateCommissionPreview(req.params.id, req.prisma, {
            allowZero: true,
            sessionPrice: Number.isFinite(effectivePrice) ? effectivePrice : undefined
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
        const creditBalance = appointment.memberId
            ? await CreditService.getBalance(req.prisma, appointment.memberId)
            : 0;
        const creditAppliedPreview = Math.min(creditBalance, priceValue);
        const remainingAfterCredit = Math.max(0, priceValue - creditAppliedPreview - (preview.totalPaid || 0));
        const paidAmount = roundMoney(appointment.paidAmount || 0);
        const dueAmount = roundMoney(Math.max(0, priceValue - paidAmount));
        const overpaidAmount = roundMoney(Math.max(0, paidAmount - priceValue));
        const responseData = {
            ...preview,
            defaultCommissionPercent,
            trainerId: (Number.isFinite(trainerId) && trainerId > 0) ? trainerId : appointment.trainerId,
            trainerName: trainerForPreview?.name || preview?.coachName || '',
            serviceName: appointment.title || '',
            effectivePrice: roundMoney(priceValue),
            originalPrice: roundMoney(appointment.price || 0),
            finalPrice: hasFinalPrice ? roundMoney(Number(appointment.finalPrice)) : null,
            paidAmount,
            dueAmount,
            overpaidAmount,
            paymentStatus: appointment.paymentStatus || (dueAmount > 0 ? 'DUE' : 'PAID'),
            creditAvailable: roundMoney(creditBalance),
            creditAppliedPreview: roundMoney(creditAppliedPreview),
            remainingAfterCredit: roundMoney(remainingAfterCredit)
        };
        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error('Preview completion error', error);
        res.status(500).json({
            success: false,
            reason: 'SERVER_ERROR',
            message: 'Failed to prepare completion'
        });
    }
});

// Delete/Cancel
router.delete('/:id', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_MANAGE), async (req, res) => {
    try {
        const appointment = await AppointmentService.deleteAppointment(req.params.id);
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Notifications for sessions (Auto-completed / Cancelled)
router.get('/notifications', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_VIEW), async (req, res) => {
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
router.get('/availability', authenticate, requirePermission(PERMISSIONS.APPOINTMENTS_VIEW), async (req, res) => {
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


