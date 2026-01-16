/**
 * ============================================
 * AUDIT LOG SERVICE
 * ============================================
 * 
 * Provides centralized logging for audit trail
 * All sensitive operations should be logged here
 */

const { PrismaClient } = require('@prisma/client');

/**
 * Create an audit log entry
 * @param {Object} prisma - Prisma client instance
 * @param {string} action - Action performed (e.g., 'CASH_CLOSING_CREATED')
 * @param {string} entityType - Type of entity (e.g., 'CashClosing')
 * @param {string|number} entityId - ID of the entity
 * @param {number} performedBy - User ID who performed the action
 * @param {Object} metadata - Additional metadata (will be JSON stringified)
 * @returns {Promise<Object>} Created audit log
 */
async function createAuditLog(prisma, action, entityType, entityId, performedBy, metadata = null) {
    try {
        const auditLog = await prisma.auditLog.create({
            data: {
                action,
                entityType,
                entityId: entityId ? String(entityId) : null,
                performedBy,
                metadata: metadata ? JSON.stringify(metadata) : null
            }
        });

        console.log(`[AUDIT] ${action} by user ${performedBy} on ${entityType} ${entityId || 'N/A'}`);
        return auditLog;
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw - audit logging failure shouldn't break the main operation
        return null;
    }
}

/**
 * Get audit logs with filters
 * @param {Object} prisma - Prisma client instance
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Audit logs
 */
async function getAuditLogs(prisma, filters = {}) {
    const { page = 1, limit = 50, action, entityType, performedBy, startDate, endDate } = filters;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (performedBy) where.performedBy = parseInt(performedBy);
    if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = new Date(startDate);
        if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            skip,
            take: parseInt(limit),
            orderBy: { timestamp: 'desc' },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                }
            }
        }),
        prisma.auditLog.count({ where })
    ]);

    return {
        logs,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
        }
    };
}

module.exports = {
    createAuditLog,
    getAuditLogs
};
