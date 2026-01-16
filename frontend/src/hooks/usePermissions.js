/**
 * ============================================
 * PERMISSIONS HOOK
 * ============================================
 * 
 * React hook for checking user permissions in components.
 * Provides can(), canAny(), and canAll() functions for UI gating.
 */

import { useAuthStore } from '../store';
import { PERMISSIONS } from '../utils/permissions';

/**
 * Hook for checking user permissions
 * @returns {Object} Permission checking functions and constants
 */
export function usePermissions() {
    const { user } = useAuthStore();

    /**
     * Check if user has a specific permission
     * @param {string} permission - Permission to check (e.g., 'reports.view_financials')
     * @returns {boolean}
     */
    // Helper: Safely normalize permissions to array
    const normalizePermissions = (input) => {
        if (!input) return [];
        if (Array.isArray(input)) return input;

        if (typeof input === 'string') {
            const trimmed = input.trim();
            // Try JSON parse if it looks like an array/object
            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    console.warn('Failed to parse permissions JSON:', e);
                    return [];
                }
            }
            // Fallback: Comma-separated list (e.g. "reports.view, members.view") or single value
            return trimmed.split(',').map(p => p.trim()).filter(Boolean);
        }
        return [];
    };

    const can = (permission) => {
        if (!user) return false;

        // Admin bypasses all permission checks (Case-insensitive)
        const userRole = user.role?.toLowerCase();
        if (userRole === 'admin') return true;

        const userPermissions = normalizePermissions(user.permissions);
        return userPermissions.includes(permission);
    };

    /**
     * Check if user has ANY of the specified permissions
     * @param {...string} permissions - Permissions to check
     * @returns {boolean}
     */
    const canAny = (...permissions) => {
        if (!user) return false;
        if (user.role === 'admin') return true;

        return permissions.some(p => can(p));
    };

    /**
     * Check if user has ALL of the specified permissions
     * @param {...string} permissions - Permissions to check
     * @returns {boolean}
     */
    const canAll = (...permissions) => {
        if (!user) return false;
        if (user.role === 'admin') return true;

        return permissions.every(p => can(p));
    };

    /**
     * Check if user is admin
     * @returns {boolean}
     */
    const isAdmin = () => {
        return user?.role?.toLowerCase() === 'admin';
    };

    return {
        can,
        canAny,
        canAll,
        isAdmin,
        PERMISSIONS
    };
}
