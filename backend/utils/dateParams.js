/**
 * ============================================
 * DATE PARAMETERS UTILITY (Native)
 * ============================================
 * 
 * Safely parses date parameters from query strings.
 * Ensures backend never crashes due to invalid dates.
 */

/**
 * Parse a start and end date from request query.
 * @param {string} from - ISO date string or YYYY-MM-DD
 * @param {string} to - ISO date string or YYYY-MM-DD
 * @returns {Object} { startDate, endDate, error }
 */
function parseDateRange(from, to) {
    try {
        if (!from || !to) {
            // Default to current month if not provided
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            return { startDate: start, endDate: end };
        }

        const startDate = new Date(from);
        const endDate = new Date(to);

        // Check validity
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return { error: 'Invalid date format. Use ISO-8601 or YYYY-MM-DD' };
        }

        // Normalize time (native)
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Check range
        if (startDate > endDate) {
            // Auto-swap instead of error
            const temp = startDate;
            return { startDate: endDate, endDate: temp };
        }

        return { startDate, endDate };
    } catch (e) {
        return { error: 'Failed to parse dates' };
    }
}

/**
 * Validate and parse a single date.
 * @param {string} dateStr 
 * @returns {Date|null}
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) ? date : null;
}

module.exports = {
    parseDateRange,
    parseDate
};
