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
                    coachId: true,
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
            const parsedSessionPrice = hasSessionPriceInput ? Number(rawSessionPrice) : NaN;
            if (!hasSessionPriceInput || !Number.isFinite(parsedSessionPrice) || parsedSessionPrice <= 0) {
                throw buildSessionPriceError();
            }

            const sessionPrice = roundMoney(parsedSessionPrice);
            let trainerCommissionPercent = null;
            if (existing?.trainerId) {
                const trainer = await tx.staffTrainer.findUnique({
                    where: { id: existing.trainerId },
                    select: { commissionPercent: true }
                });
                const parsedTrainerPercent = Number(trainer?.commissionPercent);
                if (Number.isFinite(parsedTrainerPercent) && parsedTrainerPercent >= 0 && parsedTrainerPercent <= 100) {
                    trainerCommissionPercent = parsedTrainerPercent;
                }
            }
            const commissionPercentUsed = trainerCommissionPercent ?? await CommissionService.getDefaultSessionCommissionPercent(tx);
            const trainerPayout = roundMoney((sessionPrice * commissionPercentUsed) / 100);
            const gymShare = roundMoney(sessionPrice - trainerPayout);

            let sessionPayment = null;
            const existingPayment = await tx.payment.findFirst({
                where: { appointmentId: parseInt(id) },
                orderBy: { createdAt: 'desc' }
            });
            const paymentMethod = normalizePaymentMethod(paymentData?.method || existingPayment?.method || 'other').toUpperCase();
            const paymentNotes = paymentData?.notes ? String(paymentData.notes).trim() : undefined;

            if (existingPayment) {
                const updateData = {
                    sessionPrice,
                    commissionPercentUsed,
                    trainerPayout,
                    gymShare
                };
                if (existingPayment.status !== 'completed') {
                    updateData.amount = sessionPrice;
                    updateData.method = paymentMethod;
                    updateData.status = 'pending';
                    if (paymentNotes) updateData.notes = paymentNotes;
                    updateData.createdBy = userContext?.id ?? existingPayment.createdBy;
                    if (userContext) {
                        updateData.collectorName = `${userContext.firstName} ${userContext.lastName}`;
                    }
                }
                sessionPayment = await tx.payment.update({
                    where: { id: existingPayment.id },
                    data: updateData
                });
            } else {
                const { payment } = await recordPaymentTransaction(tx, {
                    appointmentId: parseInt(id),
                    memberId: existing.memberId,
                    amount: sessionPrice,
                    method: paymentMethod,
                    status: 'pending',
                    notes: paymentNotes,
                    createdBy: userContext?.id,
                    collectorName: userContext ? `${userContext.firstName} ${userContext.lastName}` : 'System',
                    sessionPrice,
                    commissionPercentUsed,
                    trainerPayout,
                    gymShare
                }, { receiptSuffix: '-INV' });
                sessionPayment = payment;
            }

            // 2.5 Recalculate Payment Status
            const allPayments = await tx.payment.findMany({
                where: { appointmentId: parseInt(id), status: 'completed' },
                select: { amount: true }
            });
            const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0); // Includes just added one

            const sessionRemaining = Math.max(0, sessionPrice - totalPaid);

            let paymentStatus = 'unpaid';
            if (totalPaid >= sessionPrice - 0.01) paymentStatus = 'paid';
            else if (totalPaid > 0) paymentStatus = 'partial';

            // 3. Update status
            const updated = await tx.appointment.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'completed',
                    paidAmount: totalPaid,
                    paymentStatus,
                    isCompleted: true,
                    price: sessionPrice,
                    completedByEmployeeId: userContext?.id ?? undefined,
                    completedAt: new Date()
                },
                include: { member: true, coach: true, payments: true }
            });

            // 5. Process commission
            await CommissionService.processSessionCommission(updated.id, tx);

            // 6. Create coach earning (User) if applicable
            if (existing?.coachId) {
                const existingCoachEarning = await tx.coachEarning.findFirst({
                    where: { appointmentId: updated.id }
                });
                if (!existingCoachEarning) {
                    await tx.coachEarning.create({
                        data: {
                            coachId: existing.coachId,
                            memberId: existing.memberId,
                            appointmentId: updated.id,
                            amount: trainerPayout,
                            basisAmount: sessionPrice,
                            commissionType: 'percentage',
                            commissionValue: commissionPercentUsed,
                            status: 'pending'
                        }
                    });
                }
            }

            // 7. Create trainer earning (StaffTrainer) if applicable
            if (existing?.trainerId) {
                const existingEarning = await tx.trainerEarning.findUnique({
                    where: { appointmentId: updated.id }
                });
                if (!existingEarning) {
                    await tx.trainerEarning.create({
                        data: {
                            trainerId: existing.trainerId,
                            appointmentId: updated.id,
                            baseAmount: sessionPrice,
                            commissionPercent: commissionPercentUsed,
                            commissionAmount: trainerPayout,
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
