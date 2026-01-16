/**
 * ============================================
 * FINANCIAL CALCULATIONS UTILITY (FRONTEND)
 * ============================================
 * 
 * Single source of truth for frontend financial calculations
 * Mirrors backend logic for consistency
 */

/**
 * Calculate financial breakdown for a single subscription
 * @param {Object} subscription - Subscription with price and payments
 * @returns {Object} Financial breakdown
 */
export function calculateSubscriptionFinancials(subscription) {
    const subscriptionPrice = subscription.price || 0;
    const payments = subscription.payments || [];

    // Filter valid payments
    const validPayments = payments.filter(p =>
        p.status === 'completed' ||
        p.status === 'refunded' ||
        p.status === 'Partial Refund'
    );

    // Calculate totals
    const totalPaid = validPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunded = validPayments.reduce((sum, p) => sum + (p.refundedTotal || 0), 0);
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
 * Determine payment status
 * @param {number} remaining - Remaining amount
 * @param {number} netPaid - Net paid amount
 * @returns {string} Status
 */
export function determinePaymentStatus(remaining, netPaid) {
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
 * Get status badge props
 * @param {string} status - Payment status
 * @param {string} language - 'ar' or 'en'
 * @returns {Object} Badge configuration
 */
export function getStatusBadgeConfig(status, language = 'ar') {
    const configs = {
        PAID: {
            label: language === 'ar' ? 'مسدد' : 'Paid',
            color: 'emerald',
            classes: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
        },
        PARTIAL: {
            label: language === 'ar' ? 'جزئي' : 'Partial',
            color: 'amber',
            classes: 'bg-amber-500/15 text-amber-500 border-amber-500/20'
        },
        UNPAID: {
            label: language === 'ar' ? 'غير مسدد' : 'Unpaid',
            color: 'red',
            classes: 'bg-red-500/15 text-red-500 border-red-500/20'
        },
        REFUNDED: {
            label: language === 'ar' ? 'مسترد' : 'Refunded',
            color: 'gray',
            classes: 'bg-gray-500/15 text-gray-500 border-gray-500/20'
        }
    };

    return configs[status] || configs.UNPAID;
}

/**
 * Calculate aggregated totals
 * @param {Array} subscriptions - Array of subscriptions
 * @returns {Object} Totals
 */
export function calculateAggregateTotals(subscriptions = []) {
    let totalSubscriptionPrice = 0;
    let totalPaid = 0;
    let totalRefunded = 0;
    let totalNetPaid = 0;
    let totalRemaining = 0;

    subscriptions.forEach(sub => {
        const financials = calculateSubscriptionFinancials(sub);
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
        count: subscriptions.length
    };
}

/**
 * Get financial record with all details
 * @param {Object} subscription - Full subscription object
 * @returns {Object} Complete financial record
 */
export function getFinancialRecord(subscription) {
    const financials = calculateSubscriptionFinancials(subscription);
    const status = determinePaymentStatus(financials.remaining, financials.netPaid);

    return {
        ...subscription,
        ...financials,
        status
    };
}

/**
 * Format financial value for display
 * @param {number} amount - Amount to format
 * @param {string} language - 'ar' or 'en'
 * @param {Object} currencyConfig - Currency configuration
 * @returns {string} Formatted amount
 */
export function formatFinancialValue(amount, language = 'ar', currencyConfig = { code: 'EGP', symbol: 'EGP' }) {
    const absAmount = Math.abs(amount);
    const formatted = absAmount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    if (language === 'ar') {
        return `${formatted} ${currencyConfig.symbol}`;
    }
    return `${currencyConfig.symbol} ${formatted}`;
}

export default {
    calculateSubscriptionFinancials,
    determinePaymentStatus,
    getStatusBadgeConfig,
    calculateAggregateTotals,
    getFinancialRecord,
    formatFinancialValue
};
