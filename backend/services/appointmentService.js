const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CommissionService = require('./commissionService');
const { recordPaymentTransaction } = require('./paymentService');
const { roundMoney } = require('../utils/money');

const AppointmentService = {
    // ... (createAppointment remains same) ...

    /**
     * Create a new appointment
     */
    async createAppointment(data) {
        // Validate overlap
        const hasOverlap = await this.checkOverlap(data.coachId, data.start, data.end);
        if (hasOverlap) {
            throw new Error('This time slot is already booked for the selected coach.');
        }

        return await prisma.appointment.create({
            data: {
                memberId: parseInt(data.memberId),
                coachId: parseInt(data.coachId),
                title: data.title || null,
                start: new Date(data.start),
                end: new Date(data.end),
                price: parseFloat(data.price) || 0,
                status: 'scheduled',
                notes: data.notes
            },
            include: {
                member: {
                    select: { firstName: true, lastName: true, memberId: true, phone: true }
                },
                coach: {
                    select: { firstName: true, lastName: true }
                },
                financialRecord: { select: { status: true } }
            }
        });
    },

    /**
     * Check for overlapping appointments for a coach
     */
    async checkOverlap(coachId, start, end, excludeId = null) {
        const startDate = new Date(start);
        const endDate = new Date(end);

        const where = {
            coachId: parseInt(coachId),
            status: { not: 'cancelled' },
            AND: [
                { start: { lt: endDate } },
                { end: { gt: startDate } }
            ]
        };

        if (excludeId) {
            where.id = { not: parseInt(excludeId) };
        }

        const count = await prisma.appointment.count({ where });
        return count > 0;
    },

    /**
     * Get appointments with filters
     */
    async getAppointments(filters) {
        const where = {};

        if (filters.coachId) where.coachId = parseInt(filters.coachId);
        if (filters.memberId) where.memberId = parseInt(filters.memberId);
        if (filters.status) where.status = filters.status;

        if (filters.startDate && filters.endDate) {
            where.start = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
        }

        return await prisma.appointment.findMany({
            where,
            include: {
                member: {
                    select: { id: true, firstName: true, lastName: true, memberId: true, phone: true }
                },
                coach: {
                    select: { id: true, firstName: true, lastName: true }
                },
                financialRecord: { select: { status: true } },
                payments: true
            },
            orderBy: { start: 'asc' }
        });
    },

    /**
     * Update appointment
     */
    async updateAppointment(id, data) {
        // If time changed, check overlap
        if (data.start && data.end) {
            const hasOverlap = await this.checkOverlap(
                data.coachId,
                data.start,
                data.end,
                id
            );
            if (hasOverlap) {
                throw new Error('Time slot overlap.');
            }
        }

        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: {
                ...data,
                start: data.start ? new Date(data.start) : undefined,
                end: data.end ? new Date(data.end) : undefined,
                price: data.price ? parseFloat(data.price) : undefined
            },
            include: { member: true, coach: true }
        });

        // Hook: Calculate or Void commission
        if (updated.status === 'completed' || updated.status === 'auto_completed') {
            await CommissionService.processSessionCommission(updated.id);
        } else {
            // Check if it WAS completed? 
            // Simplified: If status is NOT completed, ensure no earning exists.
            // This covers: Completed -> Cancelled, Completed -> Scheduled.
            await CommissionService.voidSessionCommission(updated.id);
        }

        return updated;
    },

    /**
     * Mark appointment as completed and process commission transactionally
     */
    async completeAppointment(id, paymentData = null, userContext = null) {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch details first (needed for payment linking)
            const existing = await tx.appointment.findUnique({
                where: { id: parseInt(id) },
                select: {
                    memberId: true,
                    status: true,
                    price: true,
                    paidAmount: true,
                    subscriptionId: true
                }
            });

            if (!existing) throw new Error('Appointment not found');

            const sessionPrice = existing.price || 0;
            const paidSoFar = existing.paidAmount || 0;
            const remainingDue = Math.max(0, sessionPrice - paidSoFar);
            const isSession = !existing.subscriptionId;

            // 2. process Payment if provided
            let addedPaymentAmount = 0;
            if (paymentData && paymentData.amount > 0) {
                // SESSION RULE
                if (isSession) {
                    if (sessionPrice <= 0) {
                        throw new Error('Session price must be defined to collect payment.');
                    }
                    if (remainingDue <= 0) {
                        throw new Error('Session already settled.');
                    }
                    const requestedAmount = roundMoney(paymentData.amount);
                    if (Math.abs(requestedAmount - remainingDue) > 0.01) {
                        throw new Error('Individual sessions require full payment (no partial).');
                    }
                    paymentData.amount = remainingDue;
                }
                // Find open shift for the user to link payment
                let shiftId = null;
                if (userContext?.id) {
                    const openShift = await tx.pOSShift.findFirst({
                        where: {
                            openedBy: userContext.id,
                            closedAt: null
                        }
                    });
                    if (openShift) shiftId = openShift.id;
                }

                const { payment } = await recordPaymentTransaction(tx, {
                    ...paymentData,
                    appointmentId: parseInt(id),
                    memberId: existing.memberId,
                    status: 'completed',
                    shiftId, // Link to shift
                    createdBy: userContext?.id,
                    collectorName: userContext ? `${userContext.firstName} ${userContext.lastName}` : 'System'
                });
                addedPaymentAmount = payment.amount;
            }

            // 2.5 Recalculate Payment Status
            const allPayments = await tx.payment.findMany({
                where: { appointmentId: parseInt(id), status: 'completed' },
                select: { amount: true }
            });
            const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0); // Includes just added one

            // Get price from existing (need to fetch it)
            const aptDetails = await tx.appointment.findUnique({ where: { id: parseInt(id) } });
            const price = aptDetails.price || 0;

            const sessionRemaining = Math.max(0, sessionPrice - totalPaid);

            let paymentStatus = 'unpaid';
            if (isSession) {
                paymentStatus = sessionRemaining <= 0 ? 'paid' : 'partial';
            } else {
                if (totalPaid >= price - 0.01) paymentStatus = 'paid';
                else if (totalPaid > 0) paymentStatus = 'partial';
            }

            // 3. Update status
            const updated = await tx.appointment.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'completed',
                    paidAmount: totalPaid,
                    paymentStatus
                },
                include: { member: true, coach: true, payments: true }
            });

            // 4. Process commission
            await CommissionService.processSessionCommission(updated.id, tx);

            return updated;
        });
    },

    /**
     * Delete/Cancel appointment
     */
    async deleteAppointment(id) {
        const result = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { status: 'cancelled' }
        });

        // Ensure any existing commission is voided
        await CommissionService.voidSessionCommission(id);

        return result;
    },

    /**
     * Get booked ranges for a coach
     */
    async getCoachAvailability(coachId, from, to) {
        return await prisma.appointment.findMany({
            where: {
                coachId: parseInt(coachId),
                status: { not: 'cancelled' },
                start: {
                    gte: new Date(from),
                    lte: new Date(to) // cover end of range
                }
            },
            select: { start: true, end: true }
        });
    },

    /**
     * Auto-complete past sessions
     * Runs periodically to mark finished sessions as auto_completed
     */
    async autoCompleteSessions() {
        // Grace period: 10 minutes after end time
        const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);

        const sessions = await prisma.appointment.findMany({
            where: {
                status: 'scheduled',
                end: { lt: cutoffTime }
            },
            include: { member: true }
        });

        const results = [];
        for (const session of sessions) {
            // New Requirement: Automatically complete scheduled sessions after end time
            // regardless of check-in status (assumed completed if not cancelled manually)
            const newStatus = 'completed';

            // Update status
            const updated = await prisma.appointment.update({
                where: { id: session.id },
                data: { status: newStatus }
            });

            // Process commission for the completed session
            // The service handles idempotency (checks if earning already exists)
            await CommissionService.processSessionCommission(session.id);

            results.push(updated);
        }

        return results;
    }
};

module.exports = AppointmentService;
