/**
 * ============================================
 * FINANCIAL CALCULATIONS UTILITY
 * ============================================
 * 
 * Single source of truth for all financial calculations
 * Used by: Reports, Dashboard, Alerts, Member Profile
 */
const { roundMoney, clampMoney } = require('./money');

/**
 * Calculate financial breakdown for a single subscription
 * @param {Object} subscription - Subscription object with price
 * @param {Array} payments - Array of payment objects with amount, type, refundedTotal
 * @returns {Object} Financial breakdown
 */
function calculateSubscriptionFinancials(subscription, payments = []) {
    const subscriptionPrice = roundMoney(subscription.price || 0);

    // Separate payments by type
    const paymentRecords = payments.filter(p => {
        const s = (p.status || '').toUpperCase().trim();
        if (!s) {
            return true;
        }
        return s === 'PAID' || s === 'COMPLETED' || s === 'REFUNDED' || s === 'PARTIAL' || s === 'PARTIAL REFUND';
    });

    // Calculate totals
    const totalPaidRaw = paymentRecords.reduce((sum, p) => {
        return sum + (p.amount > 0 ? p.amount : 0);
    }, 0);

    const totalRefundedRaw = paymentRecords.reduce((sum, p) => {
        // Old style: p.refundedTotal | New style: p.amount < 0
        const negativeAmount = p.amount < 0 ? Math.abs(p.amount) : 0;
        return sum + (p.refundedTotal || 0) + negativeAmount;
    }, 0);

    const totalPaid = roundMoney(totalPaidRaw);
    const totalRefunded = roundMoney(totalRefundedRaw);
    const netPaid = roundMoney(totalPaid - totalRefunded);
    const remaining = clampMoney(subscriptionPrice - netPaid);

    return {
        subscriptionPrice,
        totalPaid,
        totalRefunded,
        netPaid,
        remaining,
        percentPaid: subscriptionPrice > 0 ? roundMoney((netPaid / subscriptionPrice) * 100) : 0
    };
}

/**
 * Determine payment status based on financials
 * @param {number} remaining - Remaining amount
 * @param {number} netPaid - Net paid amount
 * @returns {string} Status: 'PAID', 'PARTIAL', 'REFUNDED', 'UNPAID'
 */
function determinePaymentStatus(remaining, netPaid) {
    if (netPaid < 0) {
        return 'REFUNDED';
    }

    if (netPaid === 0) {
        return remaining > 0 ? 'UNPAID' : 'PAID';
    }

    if (remaining > 0) {
        return 'PARTIAL';
    }

    return 'PAID';
}

/**
 * Calculate aggregated totals for multiple subscriptions
 * @param {Array} subscriptions - Array of subscription objects with payments
 * @returns {Object} Aggregated totals
 */
function calculateMemberTotals(subscriptions = []) {
    let totalSubscriptionPrice = 0;
    let totalPaid = 0; // Gross Paid
    let totalRefunded = 0;
    let totalNetPaid = 0;
    let totalRemaining = 0;

    subscriptions.forEach(sub => {
        const financials = calculateSubscriptionFinancials(sub, sub.payments || []);
        totalSubscriptionPrice += financials.subscriptionPrice;
        totalPaid += financials.totalPaid;
        totalRefunded += financials.totalRefunded;
        totalNetPaid += financials.netPaid;
        totalRemaining += financials.remaining;
    });

    return {
        totalSubscriptionPrice: roundMoney(totalSubscriptionPrice),
        totalPaid: roundMoney(totalPaid),
        totalRefunded: roundMoney(totalRefunded),
        totalNetPaid: roundMoney(totalNetPaid),
        totalRemaining: roundMoney(totalRemaining),
        subscriptionCount: subscriptions.length
    };
}

/**
 * Calculate financial summary for a member across all subscriptions
 * @param {Object} member - Member object with subscriptions
 * @returns {Object} Member financial summary
 */
function calculateMemberFinancials(member) {
    const subscriptions = member.subscriptions || [];

    const totals = calculateMemberTotals(subscriptions);
    const status = determinePaymentStatus(totals.totalRemaining, totals.totalNetPaid);

    return {
        ...totals,
        status,
        hasOutstanding: totals.totalRemaining > 0
    };
}

/**
 * Get financial breakdown with subscription details
 * @param {Object} subscription - Full subscription with payments, member, plan
 * @returns {Object} Complete financial record
 */
function getSubscriptionFinancialRecord(subscription) {
    const financials = calculateSubscriptionFinancials(subscription, subscription.payments || []);
    const status = determinePaymentStatus(financials.remaining, financials.netPaid);

    return {
        subscriptionId: subscription.id,
        memberId: subscription.member?.id,
        memberName: subscription.member ?
            `${subscription.member.firstName} ${subscription.member.lastName}` :
            'Unknown',
        membershipNo: subscription.member?.memberId,
        planName: subscription.plan?.name || 'Unknown Plan',
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        ...financials,
        status
    };
}

/**
 * Filter subscriptions with outstanding balances
 * @param {Array} subscriptions - Array of subscription objects
 * @returns {Array} Subscriptions with remaining > 0
 */
function getOutstandingSubscriptions(subscriptions = []) {
    return subscriptions
        .map(sub => getSubscriptionFinancialRecord(sub))
        .filter(record => record.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining); // Sort by highest remaining
}

/**
 * Calculate daily revenue summary
 * @param {Array} payments - Array of payment objects
 * @returns {Object} Revenue breakdown
 */
function calculateDailyRevenue(payments = []) {
    const completedPayments = payments.filter(p => {
        const s = (p.status || '').toUpperCase();
        return s === 'PAID' || s === 'COMPLETED' || s === 'REFUNDED' || s === 'PARTIAL' || s === 'PARTIAL REFUND';
    });

    const grossRevenue = roundMoney(completedPayments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0));

    const totalRefunded = roundMoney(completedPayments.reduce((sum, p) => {
        // Sum explicit refunds plus negative amounts
        const negativeAmount = p.amount < 0 ? Math.abs(p.amount) : 0;
        return sum + (p.refundedTotal || 0) + negativeAmount;
    }, 0));

    const netRevenue = roundMoney(grossRevenue - totalRefunded);

    return {
        grossRevenue,
        totalRefunded,
        netRevenue,
        paymentCount: completedPayments.length
    };
}

/**
 * Calculate net revenue from database for a specific period
 * @param {Object} prisma - Prisma client instance
 * @param {Date} startDate - Start of period
 * @param {Date} endDate - End of period
 * @returns {Promise<Object>} Revenue stats
 */
async function calculateNetRevenue(prisma, startDate, endDate) {
    // Get ALL payments in range (positive and negative)
    const payments = await prisma.payment.findMany({
        where: {
            paidAt: { gte: startDate, lte: endDate },
            status: { in: ['completed', 'refunded', 'Partial Refund', 'PAID', 'REFUNDED', 'PARTIAL', 'PARTIAL REFUND'] }
        },
        select: { amount: true, refundedTotal: true }
    });

    // Gross = Only Sum Positive Amounts
    const grossRevenue = roundMoney(payments.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : 0), 0));

    // Refunds = Sum Negative Amounts (abs) + refundedTotal (old style)
    // NOTE: Explicit "Refund" table entries are synced with negative payments now.
    // If we rely on payments table, we don't need to query Refund table separately for the sum, 
    // unless there are refunds that DON'T have a negative payment (Old system?).
    // Safe bet: Query Refund table for total, AND use payments for Gross.
    // But wait, if I use Refund Table, I should ignore negative payments in "Refunds" sum to avoid double counting?
    // No, Refund Table is the source of truth for "Refund Events".
    // Negative Payments are the ledger representation.
    // So: Gross = Sum(Payments > 0). Total Refunds = Sum(Refund Table). Net = Gross - Total Refunds.
    // This assumes every Refund Entry has a corresponding Negative Payment (which I implemented).
    // And assumes NO negative payments exist without a Refund Entry.

    // Let's stick to the decoupled robust approach:
    // Gross = Sum(Payments where amount > 0)
    // Refunds = Sum(Refund Table) -> This is cleaner for "Refunds issued in this period".

    const refunds = await prisma.refund.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate }
        },
        select: { amount: true }
    });

    const totalRefunds = roundMoney(refunds.reduce((sum, r) => sum + (r.amount || 0), 0));

    return {
        grossRevenue,
        totalRefunds,
        netRevenue: roundMoney(grossRevenue - totalRefunds),
        paymentCount: payments.length,
        refundCount: refunds.length
    };
}

const COMPLETED_PAYMENT_STATUSES = ['completed', 'COMPLETED', 'paid', 'PAID', 'refunded', 'REFUNDED', 'Partial Refund', 'PARTIAL REFUND'];
const COMPLETED_APPOINTMENT_STATUSES = ['completed', 'COMPLETED'];

function normalizeRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return null;
    }

    if (start > end) {
        return { start: end, end: start };
    }

    return { start, end };
}

function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function normalizePaymentMethod(method) {
    const normalized = String(method || 'cash').toLowerCase();
    if (normalized.includes('card') || normalized.includes('visa') || normalized.includes('master') || normalized.includes('credit') || normalized.includes('debit')) return 'card';
    if (normalized.includes('transfer') || normalized.includes('bank')) return 'transfer';
    return 'cash';
}

function normalizePayoutMethod(method) {
    const normalized = String(method || 'CASH').toLowerCase();
    if (normalized.includes('transfer') || normalized.includes('bank')) return 'transfer';
    if (normalized.includes('card') || normalized.includes('visa') || normalized.includes('master') || normalized.includes('credit') || normalized.includes('debit')) return 'card';
    return 'cash';
}

function zeroCashClosingStats() {
    return {
        expectedCashAmount: 0,
        expectedNonCashAmount: 0,
        expectedTotalAmount: 0,
        expectedCardAmount: 0,
        expectedTransferAmount: 0,
        cardTotal: 0,
        transferTotal: 0,
        paymentCount: 0,
        refundCount: 0,
        cashIn: 0,
        cashOut: 0,
        nonCashIn: 0,
        nonCashOut: 0,
        cardOut: 0,
        transferOut: 0,
        payInTotal: 0,
        payOutTotal: 0,
        payoutsTotal: 0,
        payoutsCashTotal: 0,
        payoutsTransferTotal: 0,
        payoutsCardTotal: 0,
        cashInTotal: 0,
        cashOutTotal: 0,
        salesCount: 0,
        salesTotal: 0,
        subscriptionSalesTotal: 0,
        subscriptionCashTotal: 0,
        subscriptionNonCashTotal: 0,
        subscriptionCardTotal: 0,
        subscriptionTransferTotal: 0,
        posCashTotal: 0,
        posCardTotal: 0,
        posTransferTotal: 0,
        posNonCashTotal: 0,
        refundsTotal: 0,
        cashRefundsTotal: 0,
        nonCashRefundsTotal: 0
    };
}

/**
 * Calculate Cash Closing Stats (Cash vs Non-Cash logic)
 * Net Cash = Cash Payments - Cash Refunds
 * @param {Object} prisma - Prisma client
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {number|null} employeeId - Optional filter
 * @returns {Promise<Object>} Closing Stats
 */
async function calculateCashClosingStats(prisma, startDate, endDate, employeeId = null) {
    const range = normalizeRange(startDate, endDate);
    if (!range) {
        return zeroCashClosingStats();
    }

    const { start, end } = range;
    const parsedEmployeeId = employeeId ? parseInt(employeeId, 10) : null;

    const paymentWhere = {
        paidAt: { gte: start, lte: end },
        status: { in: COMPLETED_PAYMENT_STATUSES }
    };

    const refundWhere = {
        createdAt: { gte: start, lte: end }
    };

    if (parsedEmployeeId) {
        paymentWhere.createdBy = parsedEmployeeId;
        // For refunds, we might want to filter by who created the refund OR who created the original payment.
        // Usually, cash closing tracks the drawer of the person closing.
        // If I am closing MY drawer, I care about payments I took and refunds I gave.
        refundWhere.createdBy = parsedEmployeeId;
    }

    const salesWhere = {
        createdAt: { gte: start, lte: end },
        ...(parsedEmployeeId ? { employeeId: parsedEmployeeId } : {})
    };

    const [payments, refunds, sales, cashMovements, trainerPayouts] = await Promise.all([
        prisma.payment.findMany({
            where: paymentWhere,
            select: { amount: true, method: true }
        }),
        prisma.refund.findMany({
            where: refundWhere,
            include: {
                payment: {
                    select: { method: true }
                }
            }
        }),
        prisma.saleTransaction.findMany({
            where: salesWhere,
            select: { totalAmount: true, paymentMethod: true }
        }),
        prisma.cashMovement.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                ...(parsedEmployeeId ? { employeeId: parsedEmployeeId } : {})
            },
            select: {
                type: true,
                amount: true
            }
        }),
        prisma.trainerPayout.findMany({
            where: {
                paidAt: { gte: start, lte: end },
                ...(parsedEmployeeId ? { paidByEmployeeId: parsedEmployeeId } : {})
            },
            select: {
                totalAmount: true,
                method: true
            }
        })
    ]);

    let subscriptionTotal = 0;
    let subscriptionCashTotal = 0;
    let subscriptionCardTotal = 0;
    let subscriptionTransferTotal = 0;
    let paymentCount = 0;

    let posSalesTotal = 0;
    let posSalesCash = 0;
    let posSalesCard = 0;
    let posSalesTransfer = 0;

    let cashRevenue = 0;
    let cardRevenue = 0;
    let transferRevenue = 0;

    let cashRefunds = 0;
    let cardRefunds = 0;
    let transferRefunds = 0;

    payments.forEach((payment) => {
        const amount = toNumber(payment.amount);
        if (amount <= 0) return;

        paymentCount += 1;
        subscriptionTotal += amount;
        const method = normalizePaymentMethod(payment.method);
        if (method === 'cash') {
            cashRevenue += amount;
            subscriptionCashTotal += amount;
            return;
        }
        if (method === 'card') {
            cardRevenue += amount;
            subscriptionCardTotal += amount;
            return;
        }
        transferRevenue += amount;
        subscriptionTransferTotal += amount;
    });

    sales.forEach((sale) => {
        const amount = toNumber(sale.totalAmount);
        if (amount <= 0) return;

        paymentCount += 1;
        posSalesTotal += amount;
        const method = normalizePaymentMethod(sale.paymentMethod);
        if (method === 'cash') {
            cashRevenue += amount;
            posSalesCash += amount;
            return;
        }
        if (method === 'card') {
            cardRevenue += amount;
            posSalesCard += amount;
            return;
        }
        transferRevenue += amount;
        posSalesTransfer += amount;
    });

    refunds.forEach((refund) => {
        const amount = toNumber(refund.amount);
        if (amount <= 0) return;

        const method = normalizePaymentMethod(refund.payment?.method);
        if (method === 'cash') {
            cashRefunds += amount;
            return;
        }
        if (method === 'card') {
            cardRefunds += amount;
            return;
        }
        transferRefunds += amount;
    });

    let payInTotal = 0;
    let movementOutTotal = 0;
    cashMovements.forEach((movement) => {
        const amount = toNumber(movement.amount);
        if (amount <= 0) return;
        if (movement.type === 'IN') {
            payInTotal += amount;
        } else if (movement.type === 'OUT') {
            movementOutTotal += amount;
        }
    });

    let trainerPayoutsCash = 0;
    let trainerPayoutsCard = 0;
    let trainerPayoutsTransfer = 0;
    trainerPayouts.forEach((payout) => {
        const amount = toNumber(payout.totalAmount);
        if (amount <= 0) return;
        const method = normalizePayoutMethod(payout.method);
        if (method === 'cash') {
            trainerPayoutsCash += amount;
            return;
        }
        if (method === 'card') {
            trainerPayoutsCard += amount;
            return;
        }
        trainerPayoutsTransfer += amount;
    });

    const payoutsCashTotal = roundMoney(movementOutTotal + trainerPayoutsCash);
    const payoutsCardTotal = roundMoney(trainerPayoutsCard);
    const payoutsTransferTotal = roundMoney(trainerPayoutsTransfer);
    const payoutsTotal = roundMoney(payoutsCashTotal + payoutsCardTotal + payoutsTransferTotal);

    const expectedCashAmount = roundMoney(cashRevenue + payInTotal - payoutsCashTotal - cashRefunds);
    const expectedCardAmount = roundMoney(cardRevenue - payoutsCardTotal - cardRefunds);
    const expectedTransferAmount = roundMoney(transferRevenue - payoutsTransferTotal - transferRefunds);
    const expectedNonCashAmount = roundMoney(expectedCardAmount + expectedTransferAmount);
    const expectedTotalAmount = roundMoney(expectedCashAmount + expectedNonCashAmount);

    return {
        expectedCashAmount,
        expectedNonCashAmount,
        expectedTotalAmount,
        expectedCardAmount,
        expectedTransferAmount,
        cardTotal: expectedCardAmount,
        transferTotal: expectedTransferAmount,
        paymentCount,
        refundCount: refunds.length,
        cashIn: roundMoney(cashRevenue),
        cashOut: roundMoney(cashRefunds),
        nonCashIn: roundMoney(cardRevenue + transferRevenue),
        nonCashOut: roundMoney(cardRefunds + transferRefunds),
        cardOut: roundMoney(cardRefunds + payoutsCardTotal),
        transferOut: roundMoney(transferRefunds + payoutsTransferTotal),
        payInTotal: roundMoney(payInTotal),
        payOutTotal: payoutsCashTotal,
        payoutsTotal,
        payoutsCashTotal,
        payoutsTransferTotal,
        payoutsCardTotal,
        cashInTotal: roundMoney(payInTotal),
        cashOutTotal: payoutsCashTotal,
        salesCount: sales.length,
        salesTotal: roundMoney(posSalesTotal),
        subscriptionSalesTotal: roundMoney(subscriptionTotal),
        subscriptionCashTotal: roundMoney(subscriptionCashTotal),
        subscriptionNonCashTotal: roundMoney(subscriptionCardTotal + subscriptionTransferTotal),
        subscriptionCardTotal: roundMoney(subscriptionCardTotal),
        subscriptionTransferTotal: roundMoney(subscriptionTransferTotal),
        posCashTotal: roundMoney(posSalesCash),
        posCardTotal: roundMoney(posSalesCard),
        posTransferTotal: roundMoney(posSalesTransfer),
        posNonCashTotal: roundMoney(posSalesCard + posSalesTransfer),
        refundsTotal: roundMoney(cashRefunds + cardRefunds + transferRefunds),
        cashRefundsTotal: roundMoney(cashRefunds),
        nonCashRefundsTotal: roundMoney(cardRefunds + transferRefunds)
    };
}

function zeroFinancialSnapshot() {
    return {
        totalSessions: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        cardRevenue: 0,
        transferRevenue: 0,
        trainerCommissions: 0,
        payoutsTotal: 0,
        cashInTotal: 0,
        expectedCash: 0,
        expectedNonCash: 0,
        expectedCard: 0,
        expectedTransfer: 0,
        cashRefundsTotal: 0,
        nonCashRefundsTotal: 0,
        payoutsCashTotal: 0,
        payoutsTransferTotal: 0,
        breakdownByCoach: [],
        breakdownByService: []
    };
}

async function calculateFinancialSnapshot(prisma, startDate, endDate) {
    const range = normalizeRange(startDate, endDate);
    if (!range) {
        return zeroFinancialSnapshot();
    }

    const { start, end } = range;
    const isDev = process.env.NODE_ENV !== 'production';
    const safeQuery = async (label, queryFn, fallback) => {
        try {
            return await queryFn();
        } catch (error) {
            if (isDev) {
                console.error(`[FinancialSnapshot] ${label} query failed`, error?.stack || error);
            }
            return fallback;
        }
    };

    const [closingStats, totalSessions, trainerCommissionsRaw] = await Promise.all([
        safeQuery('cash-closing-stats', () => calculateCashClosingStats(prisma, start, end), zeroCashClosingStats()),
        safeQuery(
            'sessions-count',
            () => prisma.appointment.count({
                where: {
                    status: { in: COMPLETED_APPOINTMENT_STATUSES },
                    OR: [
                        { completedAt: { gte: start, lte: end } },
                        {
                            AND: [
                                { completedAt: null },
                                { end: { gte: start, lte: end } }
                            ]
                        }
                    ]
                }
            }),
            0
        ),
        safeQuery(
            'trainer-commissions',
            () => prisma.trainerEarning.aggregate({
                where: { createdAt: { gte: start, lte: end } },
                _sum: { commissionAmount: true }
            }),
            { _sum: { commissionAmount: 0 } }
        )
    ]);

    const cashRevenue = roundMoney(closingStats.cashIn || 0);
    const cardRevenue = roundMoney((closingStats.subscriptionCardTotal || 0) + (closingStats.posCardTotal || 0));
    const transferRevenue = roundMoney((closingStats.subscriptionTransferTotal || 0) + (closingStats.posTransferTotal || 0));
    const trainerCommissions = roundMoney(trainerCommissionsRaw?._sum?.commissionAmount || 0);
    const totalRevenue = roundMoney(cashRevenue + cardRevenue + transferRevenue);

    return {
        totalSessions: Number(totalSessions) || 0,
        totalRevenue,
        cashRevenue,
        cardRevenue,
        transferRevenue,
        trainerCommissions,
        payoutsTotal: roundMoney(closingStats.payoutsTotal || 0),
        cashInTotal: roundMoney(closingStats.cashInTotal || 0),
        expectedCash: roundMoney(closingStats.expectedCashAmount || 0),
        expectedNonCash: roundMoney(closingStats.expectedNonCashAmount || 0),
        expectedCard: roundMoney(closingStats.expectedCardAmount || 0),
        expectedTransfer: roundMoney(closingStats.expectedTransferAmount || 0),
        cashRefundsTotal: roundMoney(closingStats.cashRefundsTotal || 0),
        nonCashRefundsTotal: roundMoney(closingStats.nonCashRefundsTotal || 0),
        payoutsCashTotal: roundMoney(closingStats.payoutsCashTotal || 0),
        payoutsTransferTotal: roundMoney(closingStats.payoutsTransferTotal || 0),
        breakdownByCoach: [],
        breakdownByService: []
    };
}

module.exports = {
    calculateSubscriptionFinancials,
    determinePaymentStatus,
    calculateMemberTotals,
    calculateMemberFinancials,
    getSubscriptionFinancialRecord,
    getOutstandingSubscriptions,

    calculateDailyRevenue,
    calculateNetRevenue,
    calculateCashClosingStats,
    calculateFinancialSnapshot
};
