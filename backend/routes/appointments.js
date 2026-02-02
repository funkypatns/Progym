const express = require('express');
const router = express.Router();
const AppointmentService = require('../services/appointmentService');
const { authenticate } = require('../middleware/auth');
const { parseDateRange } = require('../utils/dateParams');

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
            const message = isArabic ? 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¶Ø§ÙØ© Ø­Ø¬Ø² ÙÙŠ ØªØ§Ø±ÙŠØ® Ø³Ø§Ø¨Ù‚.' : 'You canâ€™t create a booking in a past date.';
            return res.status(400).json({ success: false, message });
        }

        const payload = {
            ...req.body,
            createdByEmployeeId: req.body.createdByEmployeeId ?? req.user?.id
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
        let now = new Date();
        if (req.query.now && process.env.NODE_ENV !== 'production') {
            const override = new Date(req.query.now);
            if (!isNaN(override.getTime())) {
                now = override;
            }
        }
        const { startDate: startDateParam, endDate: endDateParam } = req.query;
        const where = {
            end: { lt: now },
            isCompleted: false,
            status: { notIn: ['cancelled', 'no_show'] }
        };
        if (startDateParam && endDateParam) {
            const { startDate, endDate, error } = parseDateRange(startDateParam, endDateParam);
            if (error) {
                return res.json({ success: true, data: [] });
            }
            where.end = {
                lt: now,
                gte: startDate,
                lte: endDate
            };
        }
        const appointments = await req.prisma.appointment.findMany({
            where,
            include: {
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
        return res.json({ success: true, data: [] });
    }
});

// Update
router.put('/:id', authenticate, async (req, res) => {
    try {
        const appointment = await AppointmentService.updateAppointment(req.params.id, req.body);
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Complete (Transactional)
router.post('/:id/complete', authenticate, async (req, res) => {
    try {
        const { payment } = req.body;
        const appointment = await AppointmentService.completeAppointment(req.params.id, payment, req.user);
        res.json({ success: true, data: appointment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

// Quick Settle
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
        const preview = await CommissionService.calculateCommissionPreview(req.params.id, req.prisma);
        res.json({ success: true, data: preview });
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

