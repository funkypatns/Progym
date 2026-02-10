/**
 * ============================================
 * PERMISSIONS CONSTANTS
 * ============================================
 * 
 * Single source of truth for all system permissions.
 * Used by both backend middleware and frontend permission checks.
 */

const PERMISSIONS = {
    // Dashboard
    DASHBOARD_VIEW_BASIC: 'dashboard.view_basic',
    DASHBOARD_VIEW_FINANCIALS: 'dashboard.view_financials',

    // Members
    MEMBERS_VIEW: 'members.view',
    MEMBERS_CREATE: 'members.create',
    MEMBERS_EDIT: 'members.edit',
    MEMBERS_DELETE: 'members.delete',

    // Subscriptions
    SUBSCRIPTIONS_VIEW: 'subscriptions.view',
    SUBSCRIPTIONS_CREATE: 'subscriptions.create',
    SUBSCRIPTIONS_RENEW: 'subscriptions.renew',
    SUBSCRIPTIONS_FREEZE: 'subscriptions.freeze',

    // Payments
    PAYMENTS_VIEW: 'payments.view',
    PAYMENTS_CREATE: 'payments.create',
    PAYMENTS_REFUND: 'payments.refund',
    PAYMENTS_EXPORT: 'payments.export',

    // Plans
    PLANS_VIEW: 'plans.view',
    PLANS_MANAGE: 'plans.manage',

    // Reports
    REPORTS_VIEW: 'reports.view',
    REPORTS_VIEW_FINANCIALS: 'reports.view_financials',
    REPORTS_EXPORT: 'reports.export',

    // Check-ins
    CHECKINS_VIEW: 'checkins.view',
    CHECKINS_MANAGE: 'checkins.manage',

    // Employees
    EMPLOYEES_VIEW: 'employees.view',
    EMPLOYEES_MANAGE: 'employees.manage',
    EMPLOYEES_PERMISSIONS: 'employees.permissions',

    // Settings
    SETTINGS_VIEW: 'settings.view',
    SETTINGS_MANAGE: 'settings.manage',
    SETTINGS_DATA_RESET: 'settings.data_reset',

    // POS
    POS_SHIFT_OPEN: 'pos.shift_open',
    POS_SHIFT_CLOSE: 'pos.shift_close',

    // Subscription Alerts
    ALERTS_VIEW: 'alerts.view',
    ALERTS_MANAGE: 'alerts.manage',

    // Appointments
    APPOINTMENTS_VIEW: 'appointments.view',
    APPOINTMENTS_MANAGE: 'appointments.manage',
    SESSION_UNDO_COMPLETE: 'session.undo_complete',

    // Coaches
    COACHES_VIEW: 'coaches.view',
    COACHES_MANAGE: 'coaches.manage'
};

/**
 * Default permissions for new staff users
 */
const DEFAULT_STAFF_PERMISSIONS = [
    PERMISSIONS.DASHBOARD_VIEW_BASIC,
    PERMISSIONS.MEMBERS_VIEW,
    PERMISSIONS.MEMBERS_CREATE,
    PERMISSIONS.SUBSCRIPTIONS_VIEW,
    PERMISSIONS.SUBSCRIPTIONS_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.CHECKINS_VIEW,
    PERMISSIONS.CHECKINS_MANAGE,
    PERMISSIONS.POS_SHIFT_OPEN,
    PERMISSIONS.POS_SHIFT_CLOSE
];

/**
 * Permission categories for UI grouping
 */
const PERMISSION_CATEGORIES = {
    dashboard: {
        label: 'Dashboard',
        permissions: [
            PERMISSIONS.DASHBOARD_VIEW_BASIC,
            PERMISSIONS.DASHBOARD_VIEW_FINANCIALS
        ]
    },
    members: {
        label: 'Members',
        permissions: [
            PERMISSIONS.MEMBERS_VIEW,
            PERMISSIONS.MEMBERS_CREATE,
            PERMISSIONS.MEMBERS_EDIT,
            PERMISSIONS.MEMBERS_DELETE
        ]
    },
    subscriptions: {
        label: 'Subscriptions',
        permissions: [
            PERMISSIONS.SUBSCRIPTIONS_VIEW,
            PERMISSIONS.SUBSCRIPTIONS_CREATE,
            PERMISSIONS.SUBSCRIPTIONS_RENEW,
            PERMISSIONS.SUBSCRIPTIONS_FREEZE,
            PERMISSIONS.ALERTS_VIEW,
            PERMISSIONS.ALERTS_MANAGE
        ]
    },
    payments: {
        label: 'Payments',
        permissions: [
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.PAYMENTS_CREATE,
            PERMISSIONS.PAYMENTS_REFUND,
            PERMISSIONS.PAYMENTS_EXPORT
        ]
    },
    plans: {
        label: 'Plans',
        permissions: [
            PERMISSIONS.PLANS_VIEW,
            PERMISSIONS.PLANS_MANAGE
        ]
    },
    reports: {
        label: 'Reports',
        permissions: [
            PERMISSIONS.REPORTS_VIEW,
            PERMISSIONS.REPORTS_VIEW_FINANCIALS,
            PERMISSIONS.REPORTS_EXPORT
        ]
    },
    checkins: {
        label: 'Check-ins',
        permissions: [
            PERMISSIONS.CHECKINS_VIEW,
            PERMISSIONS.CHECKINS_MANAGE
        ]
    },
    employees: {
        label: 'Employees',
        permissions: [
            PERMISSIONS.EMPLOYEES_VIEW,
            PERMISSIONS.EMPLOYEES_MANAGE,
            PERMISSIONS.EMPLOYEES_PERMISSIONS
        ]
    },
    settings: {
        label: 'Settings',
        permissions: [
            PERMISSIONS.SETTINGS_VIEW,
            PERMISSIONS.SETTINGS_MANAGE,
            PERMISSIONS.SETTINGS_DATA_RESET
        ]
    },
    pos: {
        label: 'POS',
        permissions: [
            PERMISSIONS.POS_SHIFT_OPEN,
            PERMISSIONS.POS_SHIFT_OPEN,
            PERMISSIONS.POS_SHIFT_CLOSE
        ]
    },
    coaching: {
        label: 'Coaching',
        permissions: [
            PERMISSIONS.APPOINTMENTS_VIEW,
            PERMISSIONS.APPOINTMENTS_MANAGE,
            PERMISSIONS.SESSION_UNDO_COMPLETE,
            PERMISSIONS.COACHES_VIEW,
            PERMISSIONS.COACHES_MANAGE
        ]
    }
};

/**
 * Get user permissions from database field
 * @param {Object} user - User object with permissions field
 * @returns {Array} Array of permission strings
 */
function getUserPermissions(user) {
    if (!user) return [];
    if (user.role === 'admin') return Object.values(PERMISSIONS); // Admin has all

    try {
        return user.permissions ? JSON.parse(user.permissions) : [];
    } catch (e) {
        console.error('Error parsing user permissions:', e);
        return [];
    }
}

/**
 * Check if user has a specific permission
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
function hasPermission(user, permission) {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin bypass

    const userPermissions = getUserPermissions(user);
    return userPermissions.includes(permission);
}

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object
 * @param {Array<string>} permissions - Permissions to check
 * @returns {boolean}
 */
function hasAnyPermission(user, permissions) {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const userPermissions = getUserPermissions(user);
    return permissions.some(p => userPermissions.includes(p));
}

/**
 * Check if user has all of the specified permissions
 * @param {Object} user - User object
 * @param {Array<string>} permissions - Permissions to check
 * @returns {boolean}
 */
function hasAllPermissions(user, permissions) {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const userPermissions = getUserPermissions(user);
    return permissions.every(p => userPermissions.includes(p));
}

module.exports = {
    PERMISSIONS,
    DEFAULT_STAFF_PERMISSIONS,
    PERMISSION_CATEGORIES,
    getUserPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
};
