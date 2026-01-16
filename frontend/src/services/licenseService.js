/**
 * ============================================
 * LICENSE SERVICE (Frontend)
 * ============================================
 * 
 * Handles license validation via backend API.
 * The backend connects to the license server.
 */

import api from '../utils/api';

export const licenseService = {
    /**
     * Initialize and check license status
     */
    initialize: async () => {
        try {
            const response = await api.get('/license/status');
            const data = response.data.data;

            return {
                valid: data.status === 'active',
                status: data.status,
                mode: data.mode,
                license: data.license,
                graceRemaining: data.graceRemaining,
                code: data.code,
                message: data.message
            };
        } catch (error) {
            console.error('License check failed:', error);
            return {
                valid: false,
                status: 'error',
                message: error.response?.data?.message || 'Failed to check license'
            };
        }
    },

    /**
     * Get hardware ID
     */
    getHardwareId: async () => {
        try {
            const response = await api.get('/license/hardware-id');
            return response.data.data.hardwareId;
        } catch (error) {
            return 'Unknown';
        }
    },

    /**
     * Activate a license key
     */
    activate: async (licenseKey, gymName = null) => {
        try {
            const response = await api.post('/license/activate', {
                licenseKey,
                gymName
            });

            if (response.data.success) {
                return {
                    valid: true,
                    success: true,
                    license: response.data.data
                };
            }

            return {
                valid: false,
                success: false,
                code: response.data.code,
                message: response.data.message
            };
        } catch (error) {
            return {
                valid: false,
                success: false,
                code: error.response?.data?.code || 'ERROR',
                message: error.response?.data?.message || 'Activation failed'
            };
        }
    },

    /**
     * Validate current license
     */
    validate: async (licenseKey = null) => {
        try {
            const response = await api.post('/license/validate', { licenseKey });
            return response.data.data;
        } catch (error) {
            return {
                valid: false,
                code: 'ERROR',
                message: error.response?.data?.message || 'Validation failed'
            };
        }
    }
};

export default licenseService;
