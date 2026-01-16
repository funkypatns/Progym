/**
 * ============================================
 * ZUSTAND STATE STORES
 * ============================================
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

// ============================================
// AUTH STORE
// ============================================

export const useAuthStore = create(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,

            login: async (username, password) => {
                set({ isLoading: true });
                try {
                    const response = await api.post('/auth/login', { username, password });
                    const { user, token } = response.data.data;

                    set({
                        user,
                        token,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Set token in API instance
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                    return { success: true };
                } catch (error) {
                    set({ isLoading: false });
                    return {
                        success: false,
                        message: error.response?.data?.message || 'Login failed',
                    };
                }
            },

            logout: async () => {
                try {
                    await api.post('/auth/logout');
                } catch (error) {
                    // Ignore errors
                }

                set({
                    user: null,
                    token: null,
                    isAuthenticated: false,
                });

                // Clear POS state
                usePosStore.getState().reset();

                delete api.defaults.headers.common['Authorization'];
            },

            refreshSession: async () => {
                const token = get().token;
                if (!token) return;

                try {
                    // Ensure header is set
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                    const response = await api.get('/auth/me');
                    if (response.data.success) {
                        set({ user: response.data.data });
                    }
                } catch (error) {
                    console.error('Session refresh failed:', error);
                    // Optional: Logout if 401? handled by interceptor usually.
                }
            },

            updateUser: (userData) => {
                set({ user: { ...get().user, ...userData } });
            },

            initAuth: () => {
                const token = get().token;
                if (token) {
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                }
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

// ============================================
// THEME STORE
// ============================================

export const useThemeStore = create(
    persist(
        (set) => ({
            theme: 'dark',

            setTheme: (theme) => {
                set({ theme });

                if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            },

            toggleTheme: () => {
                set((state) => {
                    const newTheme = state.theme === 'dark' ? 'light' : 'dark';

                    if (newTheme === 'dark') {
                        document.documentElement.classList.add('dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                    }

                    return { theme: newTheme };
                });
            },
        }),
        {
            name: 'theme-storage',
        }
    )
);

// ============================================
// SETTINGS STORE
// ============================================

export const useSettingsStore = create(
    persist(
        (set, get) => ({
            settings: {},
            isLoading: false,

            fetchSettings: async () => {
                set({ isLoading: true });
                try {
                    const response = await api.get('/settings');
                    set({ settings: response.data.data, isLoading: false });
                } catch (error) {
                    set({ isLoading: false });
                }
            },

            updateSettings: async (newSettings) => {
                try {
                    await api.put('/settings', { settings: newSettings });
                    set({ settings: { ...get().settings, ...newSettings } });
                    return { success: true };
                } catch (error) {
                    return { success: false, message: error.response?.data?.message };
                }
            },

            getSetting: (key, defaultValue = '') => {
                const settings = get().settings;
                // Direct access
                if (settings[key] !== undefined) return settings[key];

                // Flatten nested settings
                for (const group in settings) {
                    if (typeof settings[group] === 'object' && settings[group] && settings[group][key] !== undefined) {
                        return settings[group][key];
                    }
                }
                return defaultValue;
            },

            reset: async () => {
                await get().fetchSettings();
            }
        }),
        {
            name: 'settings-storage',
            partialize: (state) => ({ settings: state.settings }),
        }
    )
);

// ============================================
// SIDEBAR STORE
// ============================================

export const useSidebarStore = create(
    persist(
        (set) => ({
            isCollapsed: false,

            toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
            setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
        }),
        {
            name: 'sidebar-storage',
        }
    )
);

// ============================================
// LICENSE STORE
// ============================================

import { licenseService } from '../services/licenseService';

export const useLicenseStore = create((set) => ({
    license: null,
    isValid: false,
    isLoading: true,
    hardwareId: null,

    checkLicense: async () => {
        set({ isLoading: true });
        try {
            const status = await licenseService.initialize();
            const hwid = await licenseService.getHardwareId();

            set({
                license: status.license, // Unwrap the details object
                isValid: status.valid,
                isLoading: false,
                hardwareId: hwid
            });
            return status;
        } catch (error) {
            set({ isLoading: false, isValid: false });
            return { valid: false, error: error.message };
        }
    },

    activateLicense: async (licenseKey) => {
        set({ isLoading: true });
        try {
            const result = await licenseService.activate(licenseKey);
            set({
                license: result.license, // Unwrap the details object
                isValid: result.valid,
                isLoading: false
            });
            return result;
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.message };
        }
    },
}));

// ============================================
// PLANS STORE
// ============================================

export const usePlanStore = create((set, get) => ({
    plans: [],
    isLoading: false,

    fetchPlans: async (activeOnly = false) => {
        set({ isLoading: true });
        try {
            const response = await api.get(`/plans${activeOnly ? '?active=true' : ''}`);
            set({ plans: response.data.data, isLoading: false });
        } catch (error) {
            set({ isLoading: false });
            console.error('Failed to fetch plans', error);
        }
    },

    createPlan: async (planData) => {
        set({ isLoading: true });
        try {
            const response = await api.post('/plans', planData);
            set(state => ({
                plans: [...state.plans, response.data.data],
                isLoading: false
            }));
            return { success: true };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.response?.data?.message || 'Failed to create plan' };
        }
    },

    updatePlan: async (id, planData) => {
        set({ isLoading: true });
        try {
            const response = await api.put(`/plans/${id}`, planData);
            set(state => ({
                plans: state.plans.map(p => p.id === id ? response.data.data : p),
                isLoading: false
            }));
            return { success: true };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.response?.data?.message || 'Failed to update plan' };
        }
    },

    deletePlan: async (id) => {
        set({ isLoading: true });
        try {
            await api.delete(`/plans/${id}`);
            set(state => ({
                plans: state.plans.filter(p => p.id !== id),
                isLoading: false
            }));
            return { success: true };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.response?.data?.message || 'Failed to delete plan' };
        }
    },

    reset: () => {
        set({ plans: [], isLoading: false });
    }
}));

// ============================================
// FEATURE FLAGS STORE
// ============================================
// NOTE: PACKAGES_MODE='hidden' - All features enabled, packages UI hidden

export const useFeatureFlagsStore = create((set, get) => ({
    currentPackage: null,
    // ALL features enabled by default when packages are hidden
    enabledFeatures: [
        'member_management', 'subscription_management', 'check_in', 'payments', 'basic_reports',
        'multi_language', 'multi_currency', 'advanced_reports', 'data_export', 'branding',
        'ai_insights', 'cloud_backup', 'whatsapp_notifications', 'auto_updates', 'multi_branch', 'api_access'
    ],
    allPackages: [],
    isLoading: false,
    initialized: true,
    packagesVisible: false, // Packages UI hidden

    initialize: async () => {
        // Packages hidden - all features enabled, no API call needed
        set({ isLoading: false, initialized: true });
        return null;
    },

    isEnabled: (featureId) => {
        // All features enabled when packages hidden
        return true;
    },

    setPackage: async (packageId) => {
        // No-op when packages hidden
        return { success: true };
    }
}));

// ============================================
// POS STORE
// ============================================

export const usePosStore = create((set, get) => ({
    machine: null,
    currentShift: null,
    isLoading: true,
    error: null,

    initialize: async () => {
        set({ isLoading: true, error: null });
        try {
            // Get or create local machine key
            let machineKey = localStorage.getItem('gym_pos_machine_key');
            if (!machineKey) {
                machineKey = 'POS-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                localStorage.setItem('gym_pos_machine_key', machineKey);
            }

            const response = await api.get(`/pos/status?machineKey=${machineKey}`);
            const { machine, currentShift } = response.data.data;

            set({
                machine,
                currentShift,
                isLoading: false
            });
            return { machine, currentShift };
        } catch (error) {
            set({ isLoading: false, error: 'Failed to initialize POS' });
            return null;
        }
    },

    openShift: async (openingCash) => {
        const { machine } = get();
        if (!machine) return { success: false, message: 'Machine not initialized' };

        set({ isLoading: true });
        try {
            const response = await api.post('/pos/shift/open', {
                machineId: machine.id,
                openingCash
            });

            set({
                currentShift: response.data.data,
                isLoading: false
            });
            return { success: true };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.response?.data?.message || 'Failed to open shift' };
        }
    },

    closeShift: async (closingCash) => {
        const { currentShift } = get();
        if (!currentShift) return { success: false, message: 'No active shift' };

        set({ isLoading: true });
        try {
            const response = await api.post('/pos/shift/close', {
                shiftId: currentShift.id,
                closingCash
            });

            set({
                currentShift: null, // Shift is now closed
                isLoading: false
            });
            return { success: true, data: response.data.data };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.response?.data?.message || 'Failed to close shift' };
        }
    },

    getShiftSummary: async (shiftId) => {
        set({ isLoading: true });
        try {
            const response = await api.get(`/pos/shift/${shiftId}/summary`);
            set({ isLoading: false });
            return { success: true, data: response.data.data };
        } catch (error) {
            set({ isLoading: false });
            return { success: false, message: error.response?.data?.message || 'Failed to fetch summary' };
        }
    },

    reset: () => {
        set({
            machine: null,
            currentShift: null,
            isLoading: false,
            error: null
        });
    }
}));


