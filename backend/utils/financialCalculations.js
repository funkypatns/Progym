/**
 * ============================================
 * FINANCIAL CALCULATIONS UTILITY
 * ============================================
 * 
 * Single source of truth for all financial calculations
 * Used by: Reports, Dashboard, Alerts, Member Profile
 */

/**
 * Calculate financial breakdown for a single subscription
 * @param {Object} subscription - Subscription object with price
 * @param {Array} payments - Array of payment objects with amount, type, refundedTotal
 * @returns {Object} Financial breakdown
 */
function calculateSubscriptionFinancials(subscription, payments = []) {
    const subscriptionPrice = subscription.price || 0;

    // Separate payments by type
    const paymentRecords = payments.filter(p =>
        p.status === 'completed' ||
        p.status === 'refunded' ||
        p.status === 'Partial Refund'
    );

    // Calculate totals
    const totalPaid = paymentRecords.reduce((sum, p) => {
        return sum + (p.amount || 0);
    }, 0);

    const totalRefunded = paymentRecords.reduce((sum, p) => {
        return sum + (p.refundedTotal || 0);
    }, 0);

    const netPaid = totalPaid - totalRefunded;
    const remaining = Math.max(0, subscriptionPrice - netPaid);

    return {
        subscriptionPrice,
        totalPaid,
        totalRefunded,
        netPaid,
        remaining,
        percentPaid: subscriptionPrice > 0 ? (netPaid / subscriptionPrice) * 100 : 0
    };
}

/**
 * Determine payment status based on financials
 * @param {number} remaining - Remaining amount
 * @param {number} netPaid - Net paid amount
 * @returns {string} Status: 'PAID', 'PARTIAL', 'REFUNDED', 'UNPAID'
 */
function determinePaymentStatus(remaining, netPaid) {
    if (remaining === 0 && netPaid > 0) {
        return 'PAID';
    }

    if (netPaid <= 0) {
        return 'REFUNDED';
    }

    if (remaining > 0 && netPaid > 0) {
        return 'PARTIAL';
    }

    return 'UNPAID';
}

/**
 * Calculate aggregated totals for multiple subscriptions
 * @param {Array} subscriptions - Array of subscription objects with payments
 * @returns {Object} Aggregated totals
 */
function calculateMemberTotals(subscriptions = []) {
    let totalSubscriptionPrice = 0;
    let totalPaid = 0;
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
        totalSubscriptionPrice,
        totalPaid,
        totalRefunded,
        totalNetPaid,
        totalRemaining,
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
    const completedPayments = payments.filter(p =>
        p.status === 'completed' ||
        p.status === 'refunded' ||
        p.status === 'Partial Refund'
    );

    const grossRevenue = completedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunded = completedPayments.reduce((sum, p) => sum + (p.refundedTotal || 0), 0);
    const netRevenue = grossRevenue - totalRefunded;

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
    // Get gross payments
    const payments = await prisma.payment.findMany({
        where: {
            paidAt: { gte: startDate, lte: endDate },
            status: { in: ['completed', 'refunded', 'Partial Refund'] }
        },
        select: { amount: true }
    });

    // Get executed refunds
    const refunds = await prisma.refund.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate }
        },
        select: { amount: true }
    });

    const grossRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunds = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
        grossRevenue,
        totalRefunds,
        netRevenue: grossRevenue - totalRefunds,
        paymentCount: payments.length,
        refundCount: refunds.length
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
    const paymentWhere = {
        paidAt: { gte: startDate, lte: endDate },
        status: { in: ['completed', 'refunded', 'Partial Refund'] }
    };

    const refundWhere = {
        createdAt: { gte: startDate, lte: endDate }
    };

    if (employeeId) {
        paymentWhere.createdBy = parseInt(employeeId);
        // For refunds, we might want to filter by who created the refund OR who created the original payment.
        // Usually, cash closing tracks the drawer of the person closing.
        // If I am closing MY drawer, I care about payments I took and refunds I gave.
        refundWhere.createdBy = parseInt(employeeId);
    }

    // 1. Get Payments grouped by method
    const payments = await prisma.payment.findMany({
        where: paymentWhere,
        select: { amount: true, method: true }
    });

    // 2. Get Refunds (check original payment method)
    // Note: If I refunded a payment created by someone else, does it come from my drawer?
    // Yes, if I am the one processing the refund, I am giving out cash.
    const refunds = await prisma.refund.findMany({
        where: refundWhere,
        include: {
            payment: {
                select: { method: true }
            }
        }
    });

    // 3. Get Retail Sales (POS)
    const salesWhere = {
        createdAt: { gte: startDate, lte: endDate },
        ...(employeeId ? { employeeId: parseInt(employeeId) } : {})
    };

    const sales = await prisma.saleTransaction.findMany({
        where: salesWhere,
        select: { totalAmount: true, paymentMethod: true }
    });

    sales.forEach(s => {
        const method = (s.paymentMethod || 'cash').toLowerCase();
        const amount = s.totalAmount || 0;

        if (method === 'cash') {
            cashIn += amount;
        } else {
            nonCashIn += amount;
            if (method.includes('card')) {
                cardIn += amount;
            } else if (method.includes('transfer')) {
                transferIn += amount;
            }
        }
    });

    // 4. Get Cash Movements
    const cashMovements = await prisma.cashMovement.findMany({
        where: {
            createdAt: { gte: startDate, lte: endDate },
            ...(employeeId ? { employeeId: parseInt(employeeId) } : {})
        }
    });

    let payInTotal = 0;
    let payOutTotal = 0;

    cashMovements.forEach(m => {
        if (m.type === 'IN') {
            payInTotal += m.amount;
        } else if (m.type === 'OUT') {
            payOutTotal += m.amount;
        }
    });

    // Expected Cash = (Sales - Refunds) + (Pay In - Pay Out)
    const netSalesCash = cashIn - cashOut;
    const expectedCashAmount = netSalesCash + payInTotal - payOutTotal;

    return {
        expectedCashAmount, // Includes Pay In/Out
        expectedNonCashAmount: nonCashIn - nonCashOut,
        expectedTotalAmount: expectedCashAmount + (nonCashIn - nonCashOut),
        cardTotal: cardIn,
        transferTotal: transferIn,
        paymentCount: payments.length + sales.length, // Include sales count?
        refundCount: refunds.length,
        cashIn,
        cashOut,
        payInTotal,
        payOutTotal,
        salesCount: sales.length,
        salesTotal: sales.reduce((sum, s) => sum + s.totalAmount, 0)
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
    calculateCashClosingStats
};
