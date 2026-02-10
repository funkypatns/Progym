const { roundMoney } = require('../utils/money');

/**
 * Lightweight member credit ledger utilities.
 * Positive amounts add credit, negative amounts consume credit.
 */
const CreditService = {
    async getBalance(prisma, memberId) {
        if (!prisma?.memberCreditLedger?.aggregate) {
            return 0;
        }
        const result = await prisma.memberCreditLedger.aggregate({
            where: { memberId: parseInt(memberId) },
            _sum: { amount: true }
        });
        return roundMoney(result._sum.amount || 0);
    },

    async addEntry(prisma, {
        memberId,
        amount,
        note,
        sourceAppointmentId = null,
        appliedAppointmentId = null,
        createdByUserId = null
    }) {
        if (!prisma?.memberCreditLedger?.create) {
            return null;
        }
        const safeAmount = roundMoney(amount || 0);
        if (!Number.isFinite(safeAmount) || safeAmount === 0) return null;
        return prisma.memberCreditLedger.create({
            data: {
                memberId: parseInt(memberId),
                amount: safeAmount,
                note: note ? String(note) : null,
                sourceAppointmentId: sourceAppointmentId ? parseInt(sourceAppointmentId) : null,
                appliedAppointmentId: appliedAppointmentId ? parseInt(appliedAppointmentId) : null,
                createdByUserId: createdByUserId ? parseInt(createdByUserId) : null
            }
        });
    },

    /**
     * Apply available credit up to neededAmount. Returns { applied, balanceAfter }.
     */
    async applyCredit(prisma, memberId, neededAmount, options = {}) {
        const required = roundMoney(Math.max(neededAmount || 0, 0));
        if (required <= 0) {
            const balance = await this.getBalance(prisma, memberId);
            return { applied: 0, balanceAfter: balance };
        }
        const balance = await this.getBalance(prisma, memberId);
        const applied = roundMoney(Math.min(balance, required));
        if (applied > 0) {
            await this.addEntry(prisma, {
                memberId,
                amount: -applied,
                note: options.note || 'Credit applied to session',
                appliedAppointmentId: options.appliedAppointmentId,
                createdByUserId: options.createdByUserId || null
            });
        }
        return { applied, balanceAfter: roundMoney(balance - applied) };
    },

    /**
     * Adjust credit based on overpayment delta. Positive delta => add credit, negative delta => remove up to balance.
     */
    async adjustCreditDelta(prisma, memberId, deltaAmount, options = {}) {
        const delta = roundMoney(deltaAmount || 0);
        if (delta === 0) return { deltaApplied: 0, balanceAfter: await this.getBalance(prisma, memberId) };

        if (delta > 0) {
            await this.addEntry(prisma, {
                memberId,
                amount: delta,
                note: options.note || 'Overpayment credit',
                sourceAppointmentId: options.sourceAppointmentId,
                createdByUserId: options.createdByUserId || null
            });
            const balanceAfter = await this.getBalance(prisma, memberId);
            return { deltaApplied: delta, balanceAfter };
        }

        // delta < 0 => reduce credit (consume / clawback)
        const balance = await this.getBalance(prisma, memberId);
        const removal = Math.min(balance, Math.abs(delta));
        if (removal > 0) {
            await this.addEntry(prisma, {
                memberId,
                amount: -removal,
                note: options.note || 'Credit adjustment',
                appliedAppointmentId: options.sourceAppointmentId,
                createdByUserId: options.createdByUserId || null
            });
        }
        const balanceAfter = await this.getBalance(prisma, memberId);
        return { deltaApplied: removal > 0 ? -removal : 0, balanceAfter };
    }
};

module.exports = CreditService;
