const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CommissionService = require('./commissionService');
const { recordPaymentTransaction, normalizePaymentMethod } = require('./paymentService');
const { roundMoney } = require('../utils/money');

const createInvalidTimeError = () => {
    const err = new Error('Invalid time or duration.');
    err.arabicMessage = 'وقت أو مدة غير صالحة.';
    return err;
};

const createOverlapError = () => {
    const err = new Error('This time is already booked. Choose another time.');
    err.arabicMessage = 'هذا الوقت محجوز بالفعل. اختر وقتا آخر.';
    return err;
};

const buildTimeRange = (startValue, durationMinutes) => {
    const startDate = new Date(startValue);
    if (Number.isNaN(startDate.getTime())) {
        throw createInvalidTimeError();
    }

    const duration = Number(durationMinutes);
    if (Number.isNaN(duration) || duration < 1 || duration > 600) {
        throw createInvalidTimeError();
    }

    const endDate = new Date(startDate.getTime() + duration * 60000);
    if (endDate <= startDate) {
        throw createInvalidTimeError();
    }

    return { start: startDate, end: endDate };
};

const AppointmentService = {
    // ... (createAppointment remains same) ...

    /**
     * Create a new appointment
     */
    async createAppointment(data) {
        const durationMinutes = data.durationMinutes ?? ((new Date(data.end) - new Date(data.start)) / 60000);
        const timeRange = buildTimeRange(data.start, durationMinutes);
        const coachId = parseInt(data.coachId);
        if (await this.checkOverlap(coachId, timeRange.start, timeRange.end)) {
            throw createOverlapError();
        }

        return await prisma.appointment.create({
            data: {
                memberId: parseInt(data.memberId),
                coachId,
                trainerId: data.trainerId ? parseInt(data.trainerId) : null,
                title: data.title || null,
                start: timeRange.start,
                end: timeRange.end,
                price: parseFloat(data.price) || 0,
                status: 'scheduled',
                notes: data.notes,
                createdByEmployeeId: data.createdByEmployeeId ? parseInt(data.createdByEmployeeId) : null
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
        const existing = await prisma.appointment.findUnique({
            where: { id: parseInt(id) },
            select: { coachId: true }
        });
        if (!existing) {
            throw new Error('Appointment not found');
        }

        const coachIdToUse = data.coachId ? parseInt(data.coachId) : existing.coachId;

        let overlapStart = null;
        let overlapEnd = null;

        if (data.start && (data.durationMinutes !== undefined || data.end)) {
            const durationMinutes = data.durationMinutes ?? ((new Date(data.end) - new Date(data.start)) / 60000);
            const range = buildTimeRange(data.start, durationMinutes);
            overlapStart = range.start;
            overlapEnd = range.end;
            data.start = range.start;
            data.end = range.end;
        } else if (data.start && data.end) {
            overlapStart = new Date(data.start);
            overlapEnd = new Date(data.end);
        }

        if (overlapStart && overlapEnd) {
            if (await this.checkOverlap(coachIdToUse, overlapStart, overlapEnd, id)) {
                throw createOverlapError();
            }
        }

        const updatePayload = { ...data };
        delete updatePayload.durationMinutes;
        delete updatePayload.startTime;

        const updated = await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: {
                ...updatePayload,
                coachId: updatePayload.coachId ? parseInt(updatePayload.coachId) : undefined,
                trainerId: updatePayload.trainerId !== undefined
                    ? (updatePayload.trainerId ? parseInt(updatePayload.trainerId) : null)
                    : undefined,
                start: updatePayload.start ? new Date(updatePayload.start) : undefined,
                end: updatePayload.end ? new Date(updatePayload.end) : undefined,
                price: updatePayload.price ? parseFloat(updatePayload.price) : undefined
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
                    trainerId: true,
                    status: true,
                    price: true,
                    paidAmount: true,
                    isCompleted: true,
                    completedAt: true
                }
            });

            if (!existing) throw new Error('Appointment not found');
            const alreadyCompleted = Boolean(existing.isCompleted || existing.status === 'completed' || existing.completedAt);
            if (alreadyCompleted) {
                const existingPayment = await tx.payment.findFirst({
                    where: { appointmentId: parseInt(id), status: { in: ['completed', 'pending'] } },
                    orderBy: { createdAt: 'desc' }
                });
                const appointmentDetails = await tx.appointment.findUnique({
                    where: { id: parseInt(id) },
                    include: { member: true, coach: true, payments: true }
                });
                return { appointment: appointmentDetails, sessionPayment: existingPayment || null, alreadyCompleted: true };
            }

            const buildSessionPriceError = () => {
                const err = new Error('Session price must be greater than 0');
                err.code = 'SESSION_PRICE_INVALID';
                err.message_ar = 'سعر الجلسة يجب أن يكون أكبر من صفر';
                err.message_en = 'Session price must be greater than 0';
                return err;
            };

            const rawSessionPrice = paymentData?.sessionPrice;
            const hasSessionPriceInput = rawSessionPrice !== undefined && rawSessionPrice !== null && rawSessionPrice !== '';
            const parsedSessionPrice = hasSessionPriceInput ? Number(rawSessionPrice) : null;
            if (hasSessionPriceInput && (!Number.isFinite(parsedSessionPrice) || parsedSessionPrice <= 0)) {
                throw buildSessionPriceError();
            }

            const resolvedSessionPrice = Number.isFinite(parsedSessionPrice) && parsedSessionPrice > 0
                ? parsedSessionPrice
                : Number(existing.price) || 0;
            if (!Number.isFinite(resolvedSessionPrice) || resolvedSessionPrice <= 0) {
                throw buildSessionPriceError();
            }

            const sessionPrice = resolvedSessionPrice;
            const paidSoFar = existing.paidAmount || 0;
            const remainingDue = Math.max(0, sessionPrice - paidSoFar);
            const isSession = true;
            const sessionCommission = await CommissionService.getSessionCommissionBreakdown(sessionPrice, tx);
            let sessionPayment = null;
            const existingCompletedPayment = await tx.payment.findFirst({
                where: { appointmentId: parseInt(id), status: 'completed' },
                orderBy: { createdAt: 'desc' }
            });
            const existingPendingPayment = await tx.payment.findFirst({
                where: { appointmentId: parseInt(id), status: 'pending' },
                orderBy: { createdAt: 'desc' }
            });

            // 2. process Payment if provided
            let addedPaymentAmount = 0;
            if (paymentData && Number(paymentData.amount) > 0 && !existingCompletedPayment) {
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

                if (existingPendingPayment) {
                    const method = normalizePaymentMethod(paymentData.method).toUpperCase();
                    const updatedPayment = await tx.payment.update({
                        where: { id: existingPendingPayment.id },
                        data: {
                            amount: remainingDue,
                            method,
                            status: 'completed',
                            paidAt: new Date(),
                            notes: paymentData.notes ? String(paymentData.notes).trim() : existingPendingPayment.notes,
                            shiftId, // Link to shift
                            createdBy: userContext?.id,
                            collectorName: userContext ? `${userContext.firstName} ${userContext.lastName}` : 'System',
                            sessionPrice: sessionCommission?.sessionPrice,
                            commissionPercentUsed: sessionCommission?.commissionPercentUsed,
                            trainerPayout: sessionCommission?.trainerPayout,
                            gymShare: sessionCommission?.gymShare
                        }
                    });
                    addedPaymentAmount = updatedPayment.amount;
                    sessionPayment = updatedPayment;
                } else {
                    const { payment } = await recordPaymentTransaction(tx, {
                        ...paymentData,
                        appointmentId: parseInt(id),
                        memberId: existing.memberId,
                        status: 'completed',
                        shiftId, // Link to shift
                        createdBy: userContext?.id,
                        collectorName: userContext ? `${userContext.firstName} ${userContext.lastName}` : 'System',
                        sessionPrice: sessionCommission?.sessionPrice,
                        commissionPercentUsed: sessionCommission?.commissionPercentUsed,
                        trainerPayout: sessionCommission?.trainerPayout,
                        gymShare: sessionCommission?.gymShare
                    });
                    addedPaymentAmount = payment.amount;
                    sessionPayment = payment;
                }
            } else if (existingCompletedPayment) {
                sessionPayment = existingCompletedPayment;
            }

            // 2.5 Recalculate Payment Status
            const allPayments = await tx.payment.findMany({
                where: { appointmentId: parseInt(id), status: 'completed' },
                select: { amount: true }
            });
            const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0); // Includes just added one

            const sessionRemaining = Math.max(0, sessionPrice - totalPaid);

            let paymentStatus = 'unpaid';
            if (isSession) {
                paymentStatus = sessionRemaining <= 0 ? 'paid' : 'partial';
            } else {
                if (totalPaid >= sessionPrice - 0.01) paymentStatus = 'paid';
                else if (totalPaid > 0) paymentStatus = 'partial';
            }

            // 3. Update status
            const updated = await tx.appointment.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'completed',
                    paidAmount: totalPaid,
                    paymentStatus,
                    isCompleted: true,
                    price: hasSessionPriceInput ? sessionPrice : undefined,
                    completedByEmployeeId: userContext?.id ?? undefined,
                    completedAt: new Date()
                },
                include: { member: true, coach: true, payments: true }
            });

            // 4. Create pending invoice if unpaid balance remains
            if (sessionRemaining > 0) {
                if (!existingPendingPayment) {
                    const { payment } = await recordPaymentTransaction(tx, {
                        memberId: existing.memberId,
                        appointmentId: parseInt(id),
                        amount: sessionRemaining,
                        method: 'other',
                        status: 'pending',
                        notes: 'Remaining balance for session',
                        createdBy: userContext?.id,
                        collectorName: userContext ? `${userContext.firstName} ${userContext.lastName}` : 'System',
                        sessionPrice: sessionCommission?.sessionPrice,
                        commissionPercentUsed: sessionCommission?.commissionPercentUsed,
                        trainerPayout: sessionCommission?.trainerPayout,
                        gymShare: sessionCommission?.gymShare
                    }, { receiptSuffix: '-INV' });
                    sessionPayment = sessionPayment || payment;
                } else {
                    sessionPayment = sessionPayment || existingPendingPayment;
                }
            }

            // 5. Process commission
            await CommissionService.processSessionCommission(updated.id, tx);

            // 6. Create trainer earning (StaffTrainer) if applicable
            if (existing?.trainerId) {
                const existingEarning = await tx.trainerEarning.findUnique({
                    where: { appointmentId: updated.id }
                });
                if (!existingEarning) {
                    await tx.trainerEarning.create({
                        data: {
                            trainerId: existing.trainerId,
                            appointmentId: updated.id,
                            baseAmount: Number(sessionCommission.sessionPrice) || 0,
                            commissionPercent: sessionCommission.commissionPercentUsed,
                            commissionAmount: Number(sessionCommission.trainerPayout) || 0,
                            status: 'UNPAID'
                        }
                    });
                }
            }

            return { appointment: updated, sessionPayment, alreadyCompleted: false };
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
