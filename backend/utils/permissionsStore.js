/**
 * ============================================
 * PERMISSIONS UTILS (DB-Based Implementation)
 * ============================================
 * 
 * Helpers for parsing and normalizing user permissions stored in the database.
 * The Database (User.permissions column) is the Source of Truth.
 */

const { PERMISSIONS } = require('./permissions');

/**
 * Safely parse permissions from DB string or object
 * @param {string|string[]} input - Permissions from DB (JSON string or array)
 * @returns {string[]} Array of permission strings
 */
function normalizePermissions(input) {
    if (!input) return [];
    if (Array.isArray(input)) return input;

    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return [];

        try {
            // Try parsing JSON
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            // fallback: treat as comma-separated list OR single value
            return trimmed.split(',').map(p => p.trim()).filter(Boolean);
        }
    }
    return [];
}

/**
 * Get EFFECTIVE permissions for a user (Role + DB Permissions)
 * This is the SINGLE SOURCE OF TRUTH for runtime permissions.
 * 
 * @param {Object} user - User object from DB
 * @returns {string[]} Effective permissions array
 */
function getUserEffectivePermissions(user) {
    if (!user) return [];

    // 1. Admin gets ALL permissions (Global Bypass)
    // Case-insensitive check for robustness
    if (user.role && user.role.toLowerCase() === 'admin') {
        return Object.values(PERMISSIONS);
    }

    // 2. Staff gets stored permissions from DB
    return normalizePermissions(user.permissions);
}

module.exports = {
    normalizePermissions,
    getUserEffectivePermissions
};
