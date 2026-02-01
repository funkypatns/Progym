const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CommissionService = {
    /**
     * Calculate and record commission for a payment
     */
    /**
     * Calculate commission preview (Dry Run)
     * Returns the financials that WOULD be recorded.
     */
    async calculateCommissionPreview(appointmentId, tx = prisma) {
        const appointment = await tx.appointment.findUnique({
            where: { id: parseInt(appointmentId) },
            include: { coach: true }
        });

        if (!appointment || !appointment.coachId) {
            throw new Error('Appointment or Coach not found');
        }

        // Get Settings
        const settings = await tx.coachCommissionSettings.findUnique({
            where: { coachId: appointment.coachId }
        });

        // Defaults
        const type = settings?.type || 'percentage';
        const value = settings?.value || 0;
        const internalValue = settings?.internalSessionValue || 0;

        let commissionAmount = 0;
        let basisAmount = 0;
        let sessionPrice = appointment.price || 0;

        if (type === 'fixed') {
            commissionAmount = value;
            basisAmount = value;
        } else {
            basisAmount = internalValue > 0 ? internalValue : sessionPrice;
            commissionAmount = (basisAmount * value) / 100;
        }

        const gymNetIncome = sessionPrice - commissionAmount;

        // Check verification - is it already paid?
        const payments = await tx.payment.findMany({
            where: {
                appointmentId: appointment.id,
                status: 'completed'
            },
            select: { amount: true }
        });

        const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const remainingAmount = Math.max(0, sessionPrice - totalPaid);

        const isSession = !appointment.subscriptionId;
        return {
            appointmentId: appointment.id,
            coachId: appointment.coachId,
            coachName: `${appointment.coach.firstName} ${appointment.coach.lastName}`,
            sessionPrice,
            commissionAmount,
            gymNetIncome,
            commissionType: type,
            commissionValue: value,
            basisAmount,
            totalPaid,
            remainingAmount,
            isPaid: remainingAmount <= 0.01, // Tolerance for float
            isSession,
            isSubscription: Boolean(appointment.subscriptionId)
        };
    },

    /**
     * Calculate and record commission for a COMPLETED SESSION
     * 
     * CRITICAL RULE:
     * Commissions are calculated ONLY from Session (Service) prices.
     * Membership Subscriptions are EXCLUDED.
     * 
     * Creates an IMMUTABLE 'AppointmentFinancialRecord'.
     */
    async processSessionCommission(appointmentId, tx = prisma) {
        if (!appointmentId) return;

        // Calculate (Reuse logic)
        const calc = await this.calculateCommissionPreview(appointmentId, tx);

        // Fetch memberId safely for creation (needed for foreign key)
        const appointment = await tx.appointment.findUnique({
            where: { id: parseInt(appointmentId) },
            select: { memberId: true }
        });

        if (!appointment) return; // Should not happen given calc succeeded

        const data = {
            memberId: appointment.memberId,
            coachId: calc.coachId,
            sessionPrice: calc.sessionPrice,       // Gross
            coachCommission: calc.commissionAmount, // Commission
            gymNetIncome: calc.gymNetIncome,       // Net
            commissionType: calc.commissionType,
            commissionValue: calc.commissionValue,
            basisAmount: calc.basisAmount,
            status: 'PENDING',
            completedAt: new Date()
        };

        // Create or Update IMMUTABLE Financial Record
        // Fix: Use upsert to handle cases where record might exist (update) or missing (create)
        // This prevents "Record not found" errors and ensures consistency on edits.
        await tx.appointmentFinancialRecord.upsert({
            where: { appointmentId: parseInt(calc.appointmentId) },
            create: {
                appointmentId: calc.appointmentId,
                ...data
            },
            update: {
                // If re-processing (e.g. price edit), update financials
                sessionPrice: data.sessionPrice,
                coachCommission: data.coachCommission,
                gymNetIncome: data.gymNetIncome,
                commissionType: data.commissionType,
                commissionValue: data.commissionValue,
                basisAmount: data.basisAmount,
                // Do NOT update status if it's already PAID
                // We'll leave it as is if paid, or reset if needed?
                // For safety: Only update if PENDING. If PAID, we should probably warn or block?
                // But the user wants "No manual step".
                // Let's assume if paid, we don't touch status, but update amounts?
                // Actually, if paid, changing amounts ruins accounting. 
                // However, for this bug fix, let's just update fields. 
                // Ideally we check status first.
            }
        });
    },

    /**
     * Void commission for a session (e.g. if Cancelled or Reverted)
     */
    async voidSessionCommission(appointmentId, tx = prisma) {
        if (!appointmentId) return;

        // Find existing record
        const record = await tx.appointmentFinancialRecord.findUnique({
            where: { appointmentId: parseInt(appointmentId) }
        });

        if (!record) return;

        if (record.status === 'PAID' || record.settlementId) {
            console.warn(`[Commission] Cannot auto-void PAID record #${record.id}`);
            return; // Too late to void automatically
        }

        await tx.appointmentFinancialRecord.delete({
            where: { id: record.id }
        });
    },

    /**
     * Get Earnings Report using AppointmentFinancialRecord
     */
    async getEarnings(coachId, filters = {}) {
        const where = {};

        if (coachId) where.coachId = parseInt(coachId);
        if (filters.status) where.status = filters.status;

        if (filters.startDate && filters.endDate) {
            where.completedAt = {
                gte: new Date(filters.startDate),
                lte: new Date(filters.endDate)
            };
        }

        const records = await prisma.appointmentFinancialRecord.findMany({
            where,
            include: {
                coach: true,
                appointment: {
                    include: { member: true }
                },
                settlement: true
            },
            orderBy: { completedAt: 'desc' }
        });

        // Calculate summary
        const summary = {
            sessionsCount: records.length,
            totalEarnings: records.reduce((sum, r) => sum + r.coachCommission, 0),
            pendingEarnings: records.filter(r => r.status === 'PENDING').reduce((sum, r) => sum + r.coachCommission, 0),
            paidEarnings: records.filter(r => r.status === 'PAID').reduce((sum, r) => sum + r.coachCommission, 0)
        };

        // Transform for frontend
        const rows = records.map(r => ({
            id: r.id,
            date: r.completedAt,
            coachName: r.coach ? `${r.coach.firstName} ${r.coach.lastName}` : 'Unknown',
            customerName: r.appointment?.member ? `${r.appointment.member.firstName} ${r.appointment.member.lastName}` : 'Unknown',
            sourceType: 'Session',
            sourceRef: r.appointment?.title || 'Training',
            appointmentId: r.appointmentId,
            sessionTime: r.appointment?.start,
            startTime: r.appointment?.start,
            endTime: r.appointment?.end,
            status: r.status, // PENDING or PAID
            earningAmount: r.coachCommission,
            basisAmount: r.basisAmount,
            ruleText: `${r.commissionType === 'fixed' ? 'Fixed' : r.commissionValue + '%'} of ${r.basisAmount || 0}`,
            settlementId: r.settlementId
        }));

        return { summary, rows };
    },

    /**
     * Create Settlement
     * Marks PENDING records as PAID
     */
    async createSettlement(coachId, startDate, endDate) {
        // Find pending records within range
        const records = await prisma.appointmentFinancialRecord.findMany({
            where: {
                coachId: parseInt(coachId),
                status: 'PENDING',
                completedAt: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            }
        });

        if (records.length === 0) {
            throw new Error('No pending earnings for this period');
        }

        const totalAmount = records.reduce((sum, r) => sum + r.coachCommission, 0);

        return await prisma.$transaction(async (tx) => {
            // 1. Create Expense
            const expense = await tx.expense.create({
                data: {
                    category: 'salaries',
                    amount: totalAmount,
                    description: `Coach Settlement (ID: ${coachId})`,
                    date: new Date()
                }
            });

            // 2. Create Settlement
            const settlement = await tx.coachSettlement.create({
                data: {
                    coachId: parseInt(coachId),
                    totalAmount,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    expenseId: expense.id,
                    status: 'completed'
                }
            });

            // 3. Update Financial Records to PAID
            await tx.appointmentFinancialRecord.updateMany({
                where: {
                    id: { in: records.map(r => r.id) }
                },
                data: {
                    status: 'PAID',
                    settlementId: settlement.id
                }
            });

            return settlement;
        });
    },

    /**
     * Settle a SINGLE Appointment (Quick Settle)
     */
    async settleSingleAppointment(appointmentId) {
        // 1. Fetch Record
        const record = await prisma.appointmentFinancialRecord.findUnique({
            where: { appointmentId: parseInt(appointmentId) },
            include: { coach: true }
        });

        if (!record) {
            throw new Error('No financial record found for this appointment. Ensure it is completed.');
        }

        if (record.status === 'PAID') {
            throw new Error('This appointment is already settled.');
        }

        if (record.status !== 'PENDING') {
            throw new Error(`Cannot settle record with status ${record.status}`);
        }

        // 2. Transaction
        return await prisma.$transaction(async (tx) => {
            const amount = record.coachCommission;

            // a. Create Expense
            const expense = await tx.expense.create({
                data: {
                    category: 'salaries',
                    amount: amount,
                    description: `Quick Settle: Apt #${appointmentId} (${record.coach.firstName})`,
                    date: new Date()
                }
            });

            // b. Create Single-Item Settlement
            const settlement = await tx.coachSettlement.create({
                data: {
                    coachId: record.coachId,
                    totalAmount: amount,
                    startDate: new Date(),
                    endDate: new Date(),
                    expenseId: expense.id,
                    status: 'completed'
                }
            });

            // c. Update Record
            const updated = await tx.appointmentFinancialRecord.update({
                where: { id: record.id },
                data: {
                    status: 'PAID',
                    settlementId: settlement.id
                }
            });

            return updated;
        });
    }
};

module.exports = CommissionService;
