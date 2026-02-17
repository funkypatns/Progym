if (!window.__licenseAdminDashboardBootstrapped) {
    window.__licenseAdminDashboardBootstrapped = true;
    document.addEventListener('DOMContentLoaded', () => {
    console.info('[license-admin-ui] dashboard.js loaded');

    const TOKEN_KEY = 'licenseAdminToken';
    const licenseSelect = document.getElementById('licenseSelect');
    const refreshLicensesBtn = document.getElementById('refreshLicensesBtn');
    const resetDevicesBtn = document.getElementById('resetDevicesBtn');
    const devicesBody = document.getElementById('devicesBody');
    const messageEl = document.getElementById('message');
    const licenseStats = document.getElementById('licenseStats');
    const logoutBtn = document.getElementById('logoutBtn');
    const protocolWarningEl = document.getElementById('protocolWarning');

    let licenses = [];
    let selectedLicenseId = null;
    let isBusy = false;

    function setMessage(text, isError) {
        messageEl.style.color = isError ? '#fda4af' : '#86efac';
        messageEl.textContent = text || '';
    }

    function setBusy(nextBusy) {
        isBusy = nextBusy;
        refreshLicensesBtn.disabled = nextBusy;
        resetDevicesBtn.disabled = nextBusy || !selectedLicenseId;
        logoutBtn.disabled = nextBusy;
    }

    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
    }

    function saveToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(TOKEN_KEY);
    }

    function getToken() {
        const sessionToken = sessionStorage.getItem(TOKEN_KEY);
        if (sessionToken) return sessionToken;
        const legacyToken = localStorage.getItem(TOKEN_KEY);
        if (legacyToken) {
            saveToken(legacyToken);
            return legacyToken;
        }
        return '';
    }

    function isFileProtocol() {
        return window.location.protocol === 'file:';
    }

    async function apiRequest(path, options = {}) {
        const token = getToken();
        const response = await fetch(path, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : '',
                ...(options.headers || {})
            }
        });

        if (response.status === 401) {
            clearToken();
            window.location.replace('/admin/login?error=SESSION_EXPIRED');
            return null;
        }

        let payload = null;
        try {
            payload = await response.json();
        } catch (_) {
            payload = null;
        }

        if (!response.ok || !payload?.success) {
            const code = payload?.code || `HTTP_${response.status}`;
            const message = payload?.message || 'Request failed';
            throw new Error(`${code}: ${message}`);
        }
        return payload;
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString();
    }

    function renderLicenseSelect() {
        if (!licenses.length) {
            licenseSelect.innerHTML = '<option value="">No licenses</option>';
            selectedLicenseId = null;
            return;
        }

        if (!selectedLicenseId || !licenses.find((item) => item.id === selectedLicenseId)) {
            selectedLicenseId = licenses[0].id;
        }

        licenseSelect.innerHTML = licenses.map((license) => {
            const title = `${license.key} - ${license.gymName || '-'}`;
            const selected = license.id === selectedLicenseId ? 'selected' : '';
            return `<option value="${license.id}" ${selected}>${title}</option>`;
        }).join('');
    }

    function renderStats() {
        const selected = licenses.find((item) => item.id === selectedLicenseId);
        if (!selected) {
            licenseStats.textContent = '';
            return;
        }
        licenseStats.textContent = `Approved devices: ${selected.approvedDevices || 0} / ${selected.deviceLimit || 1}`;
    }

    function renderDevices(devices) {
        if (!devices.length) {
            devicesBody.innerHTML = '<tr><td colspan="9" class="muted">No devices found for this license.</td></tr>';
            return;
        }

        devicesBody.innerHTML = devices.map((device) => {
            return `
                <tr>
                    <td>${device.deviceName || '-'}</td>
                    <td>${device.platform || '-'}</td>
                    <td>${device.appVersion || '-'}</td>
                    <td>${formatDate(device.firstActivatedAt)}</td>
                    <td>${formatDate(device.lastSeenAt)}</td>
                    <td>${device.lastSeenIp || '-'}</td>
                    <td>${device.fingerprintMasked || '-'}</td>
                    <td><span class="status ${device.status || ''}">${device.status || '-'}</span></td>
                    <td>
                        <button class="btn btn-primary action-btn" data-action="approve" data-device-id="${device.id}">Approve</button>
                        <button class="btn btn-danger action-btn" data-action="revoke" data-device-id="${device.id}">Revoke</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async function loadDevices() {
        if (!selectedLicenseId) {
            devicesBody.innerHTML = '<tr><td colspan="9" class="muted">No license selected.</td></tr>';
            return;
        }

        const payload = await apiRequest(`/api/admin/licenses/${selectedLicenseId}/devices`);
        if (!payload) return;
        renderDevices(Array.isArray(payload.data) ? payload.data : []);
    }

    async function loadLicenses() {
        setMessage('', false);
        setBusy(true);
        licenseSelect.disabled = true;
        devicesBody.innerHTML = '<tr><td colspan="9" class="muted">Loading devices...</td></tr>';
        try {
            const payload = await apiRequest('/api/admin/licenses');
            if (!payload) return;

            licenses = Array.isArray(payload.data) ? payload.data : [];
            renderLicenseSelect();
            renderStats();
            await loadDevices();
        } finally {
            setBusy(false);
            licenseSelect.disabled = false;
            resetDevicesBtn.disabled = !selectedLicenseId;
        }
    }

    async function approveDevice(deviceId) {
        await apiRequest(`/api/admin/devices/${deviceId}/approve`, { method: 'POST', body: '{}' });
        setMessage('Device approved.', false);
        await loadLicenses();
    }

    async function revokeDevice(deviceId) {
        await apiRequest(`/api/admin/devices/${deviceId}/revoke`, { method: 'POST', body: '{}' });
        setMessage('Device revoked.', false);
        await loadLicenses();
    }

    if (isFileProtocol()) {
        if (protocolWarningEl) {
            protocolWarningEl.style.display = 'block';
        }
        setMessage('Open the admin panel from http://localhost:4000/admin (not file://).', true);
        refreshLicensesBtn.disabled = true;
        resetDevicesBtn.disabled = true;
        licenseSelect.disabled = true;
        logoutBtn.disabled = true;
        return;
    }

    if (!getToken()) {
        window.location.replace('/admin/login?error=SESSION_EXPIRED');
        return;
    }

    licenseSelect.addEventListener('change', async () => {
        selectedLicenseId = Number.parseInt(licenseSelect.value, 10) || null;
        renderStats();
        resetDevicesBtn.disabled = !selectedLicenseId;
        try {
            setBusy(true);
            await loadDevices();
        } catch (error) {
            console.error('[license-admin-ui] load devices failed', error);
            setMessage(error.message, true);
        } finally {
            setBusy(false);
            resetDevicesBtn.disabled = !selectedLicenseId;
        }
    });

    refreshLicensesBtn.addEventListener('click', async () => {
        try {
            await loadLicenses();
            setMessage('Licenses refreshed.', false);
        } catch (error) {
            console.error('[license-admin-ui] refresh failed', error);
            setMessage(error.message, true);
        }
    });

    resetDevicesBtn.addEventListener('click', async () => {
        if (!selectedLicenseId || isBusy) return;
        try {
            setBusy(true);
            await apiRequest(`/api/admin/licenses/${selectedLicenseId}/reset`, { method: 'POST', body: '{}' });
            setMessage('License devices reset.', false);
            await loadLicenses();
        } catch (error) {
            console.error('[license-admin-ui] reset devices failed', error);
            setMessage(error.message, true);
        } finally {
            setBusy(false);
            resetDevicesBtn.disabled = !selectedLicenseId;
        }
    });

    devicesBody.addEventListener('click', async (event) => {
        const button = event.target.closest('.action-btn');
        if (!button || isBusy) return;

        const action = button.getAttribute('data-action');
        const deviceId = Number.parseInt(button.getAttribute('data-device-id'), 10);
        if (!Number.isInteger(deviceId)) return;

        try {
            setBusy(true);
            if (action === 'approve') {
                await approveDevice(deviceId);
            } else if (action === 'revoke') {
                await revokeDevice(deviceId);
            }
        } catch (error) {
            console.error(`[license-admin-ui] device ${action} failed`, error);
            setMessage(error.message, true);
        } finally {
            setBusy(false);
            resetDevicesBtn.disabled = !selectedLicenseId;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            setBusy(true);
            await apiRequest('/api/admin/logout', { method: 'POST', body: '{}' });
        } catch (error) {
            console.error('[license-admin-ui] logout failed', error);
        } finally {
            clearToken();
            window.location.replace('/admin/login');
        }
    });

    loadLicenses().catch((error) => {
        console.error('[license-admin-ui] initial load failed', error);
        setMessage(error.message, true);
    });
    });
}
