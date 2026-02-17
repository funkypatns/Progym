import api from '../utils/api';

const licenseAdminService = {
    listLicenses: async () => {
        const response = await api.get('/licenses');
        return response.data?.data || [];
    },

    listDevices: async (licenseKey) => {
        const response = await api.get(`/licenses/${encodeURIComponent(licenseKey)}/devices`);
        return response.data?.data || [];
    },

    approveDevice: async (licenseKey, deviceId) => {
        const response = await api.post(`/licenses/${encodeURIComponent(licenseKey)}/devices/${deviceId}/approve`);
        return response.data;
    },

    revokeDevice: async (licenseKey, deviceId, reason = '') => {
        const response = await api.post(
            `/licenses/${encodeURIComponent(licenseKey)}/devices/${deviceId}/revoke`,
            { reason }
        );
        return response.data;
    },

    resetDevices: async (licenseKey) => {
        const response = await api.post(`/licenses/${encodeURIComponent(licenseKey)}/reset-devices`);
        return response.data;
    },

    patchLicense: async (licenseKey, payload) => {
        const response = await api.patch(`/licenses/${encodeURIComponent(licenseKey)}`, payload);
        return response.data;
    },

    revokeLicense: async (licenseKey, reason = '') => {
        const response = await api.post(`/licenses/${encodeURIComponent(licenseKey)}/revoke`, { reason });
        return response.data;
    }
};

export default licenseAdminService;