/**
 * ============================================
 * PERMISSIONS CONSTANTS (Frontend)
 * ============================================
 * 
 * Mirror of backend permissions for frontend permission checks.
 * Must stay in sync with backend/utils/permissions.js
 */

export const PERMISSIONS = {
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

    // Appointments
    APPOINTMENTS_VIEW: 'appointments.view',
    APPOINTMENTS_MANAGE: 'appointments.manage',

    // Coaches
    COACHES_VIEW: 'coaches.view',
    COACHES_MANAGE: 'coaches.manage'
};

/**
 * Permission categories for UI grouping
 */
export const PERMISSION_CATEGORIES = {
    DASHBOARD: {
        label: 'Dashboard',
        permissions: [
            PERMISSIONS.DASHBOARD_VIEW_BASIC,
            PERMISSIONS.DASHBOARD_VIEW_FINANCIALS
        ]
    },
    MEMBERS: {
        label: 'Members',
        permissions: [
            PERMISSIONS.MEMBERS_VIEW,
            PERMISSIONS.MEMBERS_CREATE,
            PERMISSIONS.MEMBERS_EDIT,
            PERMISSIONS.MEMBERS_DELETE
        ]
    },
    SUBSCRIPTIONS: {
        label: 'Subscriptions',
        permissions: [
            PERMISSIONS.SUBSCRIPTIONS_VIEW,
            PERMISSIONS.SUBSCRIPTIONS_CREATE,
            PERMISSIONS.SUBSCRIPTIONS_RENEW,
            PERMISSIONS.SUBSCRIPTIONS_FREEZE
        ]
    },
    PAYMENTS: {
        label: 'Payments',
        permissions: [
            PERMISSIONS.PAYMENTS_VIEW,
            PERMISSIONS.PAYMENTS_CREATE,
            PERMISSIONS.PAYMENTS_REFUND,
            PERMISSIONS.PAYMENTS_EXPORT
        ]
    },
    PLANS: {
        label: 'Plans',
        permissions: [
            PERMISSIONS.PLANS_VIEW,
            PERMISSIONS.PLANS_MANAGE
        ]
    },
    REPORTS: {
        label: 'Reports',
        permissions: [
            PERMISSIONS.REPORTS_VIEW,
            PERMISSIONS.REPORTS_VIEW_FINANCIALS,
            PERMISSIONS.REPORTS_EXPORT
        ]
    },
    CHECKINS: {
        label: 'Check-ins',
        permissions: [
            PERMISSIONS.CHECKINS_VIEW,
            PERMISSIONS.CHECKINS_MANAGE
        ]
    },
    EMPLOYEES: {
        label: 'Employees',
        permissions: [
            PERMISSIONS.EMPLOYEES_VIEW,
            PERMISSIONS.EMPLOYEES_MANAGE,
            PERMISSIONS.EMPLOYEES_PERMISSIONS
        ]
    },
    SETTINGS: {
        label: 'Settings',
        permissions: [
            PERMISSIONS.SETTINGS_VIEW,
            PERMISSIONS.SETTINGS_MANAGE,
            PERMISSIONS.SETTINGS_DATA_RESET
        ]
    },
    POS: {
        label: 'POS',
        permissions: [
            PERMISSIONS.POS_SHIFT_OPEN,
            PERMISSIONS.POS_SHIFT_CLOSE
        ]
    },
    APPOINTMENTS: {
        label: 'Appointments',
        permissions: [
            PERMISSIONS.APPOINTMENTS_VIEW,
            PERMISSIONS.APPOINTMENTS_MANAGE
        ]
    },
    COACHES: {
        label: 'Coaches',
        permissions: [
            PERMISSIONS.COACHES_VIEW,
            PERMISSIONS.COACHES_MANAGE
        ]
    }
};

/**
 * Default permissions for new staff users
 */
export const DEFAULT_STAFF_PERMISSIONS = [
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
