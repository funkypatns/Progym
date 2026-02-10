const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CommissionService = require('./commissionService');
const { recordPaymentTransaction, normalizePaymentMethod } = require('./paymentService');
const { roundMoney } = require('../utils/money');
const { getDefaultSessionCommissionPercent } = require('./commissionService');
const CreditService = require('./creditService');

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
        const trainerId = data.trainerId ? parseInt(data.trainerId) : null;
        if (await this.checkOverlap(coachId, timeRange.start, timeRange.end)) {
            throw createOverlapError();
        }
        if (trainerId) {
            const trainer = await prisma.staffTrainer.findUnique({
                where: { id: trainerId },
                select: { id: true }
            });
            if (!trainer) {
                throw new Error('Trainer not found');
            }
        }

        return await prisma.appointment.create({
            data: {
                memberId: parseInt(data.memberId),
                coachId,
                trainerId,
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
            select: { coachId: true, status: true, isCompleted: true }
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
        if (updatePayload.trainerId !== undefined) {
            const parsedTrainerId = updatePayload.trainerId ? parseInt(updatePayload.trainerId) : null;
            if (parsedTrainerId) {
                const trainer = await prisma.staffTrainer.findUnique({
                    where: { id: parsedTrainerId },
                    select: { id: true }
                });
                if (!trainer) {
                    throw new Error('Trainer not found');
                }
            }
        }

        const isFinalized = Boolean(existing.isCompleted || existing.status === 'completed' || existing.status === 'auto_completed');
        if (isFinalized) {
            delete updatePayload.price;
        }
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
            const originalPriceRaw = Number(existing?.price);
            const hasOriginalPrice = Number.isFinite(originalPriceRaw) && originalPriceRaw > 0;
            const originalPrice = hasOriginalPrice ? originalPriceRaw : sessionPrice;
            const rawCommissionPercent = paymentData?.commissionPercent;
            const hasCommissionOverride = rawCommissionPercent !== undefined && rawCommissionPercent !== null && rawCommissionPercent !== '';
            const parsedCommissionPercent = hasCommissionOverride ? Number(rawCommissionPercent) : NaN;
            if (hasCommissionOverride && (!Number.isFinite(parsedCommissionPercent) || parsedCommissionPercent < 0 || parsedCommissionPercent > 100)) {
                const err = new Error('Commission percent must be between 0 and 100');
                err.code = 'COMMISSION_PERCENT_INVALID';
                err.message_ar = 'نسبة العمولة يجب أن تكون بين 0 و 100';
                err.message_en = 'Commission percent must be between 0 and 100';
                throw err;
            }
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
            const commissionPercentUsed = hasCommissionOverride
                ? parsedCommissionPercent
                : (trainerCommissionPercent ?? await CommissionService.getDefaultSessionCommissionPercent(tx));
            const trainerPayout = roundMoney((sessionPrice * commissionPercentUsed) / 100);
            const gymShare = roundMoney(sessionPrice - trainerPayout);

            // Credit balance (apply before creating payment to avoid over-collection)
            const creditBalance = await CreditService.getBalance(tx, existing.memberId);
            const appliedCredit = roundMoney(Math.min(creditBalance, sessionPrice));

            let sessionPayment = null;
            const existingPayment = await tx.payment.findFirst({
                where: { appointmentId: parseInt(id) },
                orderBy: { createdAt: 'desc' }
            });
            const paymentMethod = normalizePaymentMethod(paymentData?.method || existingPayment?.method || 'other').toUpperCase();
            const amountToCollect = roundMoney(Math.max(sessionPrice - appliedCredit, 0));
            const paymentCollected = Boolean(paymentData?.method) && Number.isFinite(amountToCollect) && amountToCollect > 0;
            const paymentNotes = paymentData?.notes ? String(paymentData.notes).trim() : undefined;

            if (existingPayment) {
                const updateData = {
                    sessionPrice,
                    commissionPercentUsed,
                    trainerPayout,
                    gymShare
                };
                if (existingPayment.status !== 'completed') {
                    updateData.amount = amountToCollect;
                    updateData.method = paymentMethod;
                    updateData.status = paymentCollected ? 'completed' : 'pending';
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
            } else if (paymentCollected) {
                const { payment } = await recordPaymentTransaction(tx, {
                    appointmentId: parseInt(id),
                    memberId: existing.memberId,
                    amount: amountToCollect,
                    method: paymentMethod,
                    status: paymentCollected ? 'completed' : 'pending',
                    notes: paymentNotes,
                    createdBy: userContext?.id,
                    collectorName: userContext ? `${userContext.firstName} ${userContext.lastName}` : 'System',
                    sessionPrice,
                    commissionPercentUsed,
                    trainerPayout,
                    gymShare
                }, { receiptSuffix: paymentCollected ? '' : '-INV' });
                sessionPayment = payment;
            }

            // Credit application (auto-apply to session)
            let appliedCreditUsed = 0;
            if (appliedCredit > 0) {
                const creditResult = await CreditService.applyCredit(tx, existing.memberId, appliedCredit, {
                    appliedAppointmentId: parseInt(id),
                    createdByUserId: userContext?.id ?? null,
                    note: 'Applied credit to session completion'
                });
                appliedCreditUsed = creditResult.applied;
            }

            // 2.5 Recalculate Payment Status using payments + credit applied
            const allPayments = await tx.payment.findMany({
                where: { appointmentId: parseInt(id), status: 'completed' },
                select: { amount: true }
            });
            const totalPaidCash = roundMoney(allPayments.reduce((sum, p) => sum + p.amount, 0)); // Includes just added one
            const totalPaid = roundMoney(totalPaidCash + appliedCreditUsed);

            const sessionRemaining = Math.max(0, sessionPrice - totalPaid);

            let paymentStatus = 'unpaid';
            if (sessionRemaining > 0.01 && totalPaid > 0) {
                paymentStatus = 'due';
            } else if (sessionRemaining > 0.01) {
                paymentStatus = 'due';
            } else {
                paymentStatus = 'paid';
            }

            const dueAmount = roundMoney(Math.max(0, sessionPrice - totalPaid));
            const overpaidAmount = roundMoney(Math.max(0, totalPaid - sessionPrice));

            // 3. Update status
            const updateData = {
                status: 'completed',
                paidAmount: totalPaid,
                paymentStatus,
                dueAmount,
                overpaidAmount,
                finalPrice: sessionPrice,
                isCompleted: true,
                ...(hasOriginalPrice ? {} : { price: sessionPrice }),
                completedByEmployeeId: userContext?.id ?? undefined,
                completedAt: new Date()
            };
            const updated = await tx.appointment.update({
                where: { id: parseInt(id) },
                data: updateData,
                include: { member: true, coach: true, payments: true }
            });

            // If overpaid, grant credit delta
            if (overpaidAmount > 0) {
                await CreditService.adjustCreditDelta(tx, existing.memberId, overpaidAmount, {
                    sourceAppointmentId: updated.id,
                    createdByUserId: userContext?.id ?? null,
                    note: 'Overpayment credit from session completion'
                });
            }

            let updatedTrainer = null;
            if (hasCommissionOverride && existing?.trainerId) {
                updatedTrainer = await tx.staffTrainer.update({
                    where: { id: existing.trainerId },
                    data: {
                        commissionPercent: parsedCommissionPercent,
                        commissionType: 'percentage',
                        commissionValue: parsedCommissionPercent
                    }
                });
            }

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

            return {
                appointment: updated,
                sessionPayment,
                trainer: updatedTrainer,
                alreadyCompleted: false,
                appliedCredit: appliedCreditUsed,
                dueAmount,
                overpaidAmount
            };
        });
    },

    /**
     * Adjust final price of a completed appointment (post-completion).
     * Creates audit trail and recalculates due/overpaid + trainer earning snapshot.
     * Blocks if appointment is settled.
     */
    async adjustAppointmentPrice(id, payload, userContext = null) {
        const parsedId = parseInt(id);
        if (!Number.isFinite(parsedId) || parsedId <= 0) {
            const err = new Error('Invalid appointment id');
            err.status = 400;
            throw err;
        }
        const newFinalPriceRaw = payload?.newFinalPrice ?? payload?.newPrice ?? payload?.finalPrice;
        const reason = (payload?.reason || '').trim();
        const newFinalPrice = Number(newFinalPriceRaw);

        if (!Number.isFinite(newFinalPrice) || newFinalPrice <= 0) {
            const err = new Error('New final price must be a positive number');
            err.status = 400;
            throw err;
        }
        if (!reason) {
            const err = new Error('Reason is required for price adjustment');
            err.status = 400;
            throw err;
        }

        return await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.findUnique({
                where: { id: parsedId },
                select: {
                    id: true,
                    price: true,
                    finalPrice: true,
                    paidAmount: true,
                    paymentStatus: true,
                    status: true,
                    trainerId: true,
                    memberId: true,
                    coachId: true,
                    dueAmount: true,
                    overpaidAmount: true
                }
            });
            if (!appointment) {
                const err = new Error('Appointment not found');
                err.status = 404;
                throw err;
            }
            if (!['completed', 'auto_completed'].includes(appointment.status)) {
                const err = new Error('Price can only be adjusted after completion');
                err.status = 400;
                throw err;
            }
            const originalPrice = Number(appointment.price ?? 0);
            const currentFinal = appointment.finalPrice ?? originalPrice;
            const targetFinal = roundMoney(newFinalPrice);
            const adjustmentDifference = roundMoney(targetFinal - originalPrice);
            const delta = adjustmentDifference;

            // Audit log
            const paidAmount = roundMoney(appointment.paidAmount ?? 0);
            const paymentStatusBefore = appointment.paymentStatus || 'unpaid';
            const dueBefore = Number.isFinite(appointment.dueAmount)
                ? roundMoney(appointment.dueAmount)
                : Math.max(0, currentFinal - paidAmount);
            const overpaidBefore = Number.isFinite(appointment.overpaidAmount)
                ? roundMoney(appointment.overpaidAmount)
                : Math.max(0, paidAmount - currentFinal);

            // Recompute payment status
            let dueAmount = 0;
            let overpaidAmount = 0;
            let paymentStatus = 'paid';

            if (paidAmount > targetFinal) {
                overpaidAmount = roundMoney(paidAmount - targetFinal);
                paymentStatus = 'paid';
            } else if (paidAmount < targetFinal) {
                dueAmount = roundMoney(targetFinal - paidAmount);
                paymentStatus = 'due';
            } else {
                paymentStatus = 'paid';
            }

            // Resolve commission percent
            let commissionPercent = null;
            const existingTrainerEarning = await tx.trainerEarning.findUnique({
                where: { appointmentId: appointment.id },
                select: { commissionPercent: true, status: true }
            });
            if (existingTrainerEarning?.commissionPercent !== null && existingTrainerEarning?.commissionPercent !== undefined) {
                commissionPercent = existingTrainerEarning.commissionPercent;
            } else if (appointment.trainerId) {
                const trainer = await tx.staffTrainer.findUnique({
                    where: { id: appointment.trainerId },
                    select: { commissionPercent: true }
                });
                if (trainer?.commissionPercent !== null && trainer?.commissionPercent !== undefined) {
                    commissionPercent = trainer.commissionPercent;
                }
            }
            if (commissionPercent === null || commissionPercent === undefined) {
                commissionPercent = await getDefaultSessionCommissionPercent(tx);
            }
            const commissionAmount = roundMoney((targetFinal * commissionPercent) / 100);

            // Update trainer earning snapshot (create if missing)
            if (appointment.trainerId) {
                const existing = await tx.trainerEarning.findUnique({
                    where: { appointmentId: appointment.id }
                });
                if (existing) {
                    await tx.trainerEarning.update({
                        where: { appointmentId: appointment.id },
                        data: {
                            baseAmount: targetFinal,
                            commissionAmount,
                            commissionPercent
                        }
                    });
                } else {
                    await tx.trainerEarning.create({
                        data: {
                            trainerId: appointment.trainerId,
                            appointmentId: appointment.id,
                            baseAmount: targetFinal,
                            commissionPercent,
                            commissionAmount,
                            status: 'UNPAID'
                        }
                    });
                }
            }

            // Update appointment
            const updatedAppointment = await tx.appointment.update({
                where: { id: appointment.id },
                data: {
                    finalPrice: targetFinal,
                    dueAmount,
                    overpaidAmount,
                    paymentStatus
                },
                include: {
                    payments: true,
                    trainer: true
                }
            });

            // Credit delta for overpayment changes
            const creditDelta = overpaidAmount - overpaidBefore;
            if (creditDelta !== 0) {
                await CreditService.adjustCreditDelta(tx, appointment.memberId, creditDelta, {
                    sourceAppointmentId: appointment.id,
                    createdByUserId: userContext?.id ?? null,
                    note: 'Price adjustment credit update'
                });
            }

            await tx.sessionPriceAdjustment.create({
                data: {
                    appointmentId: appointment.id,
                    oldFinalPrice: currentFinal,
                    newFinalPrice: targetFinal,
                    oldEffectivePrice: currentFinal,
                    newEffectivePrice: targetFinal,
                    delta,
                    reason,
                    changedByUserId: userContext?.id ?? null,
                    paymentStatusBefore,
                    paymentStatusAfter: paymentStatus,
                    dueBefore,
                    dueAfter: dueAmount,
                    overpaidBefore,
                    overpaidAfter: overpaidAmount
                }
            });

            await CommissionService.processSessionCommission(appointment.id, tx);

            return {
                appointment: updatedAppointment,
                appointmentId: appointment.id,
                originalPrice,
                oldPrice: currentFinal,
                newPrice: targetFinal,
                adjustmentDifference,
                paidAmount,
                paymentStatus,
                commissionPercent,
                commissionAmount,
                dueAmount,
                overpaidAmount
            };
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
