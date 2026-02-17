(function () {
    const token = localStorage.getItem('licenseAdminToken');
    if (!token) {
        window.location.replace('/admin/login');
        return;
    }

    const licenseSelect = document.getElementById('licenseSelect');
    const refreshLicensesBtn = document.getElementById('refreshLicensesBtn');
    const resetDevicesBtn = document.getElementById('resetDevicesBtn');
    const devicesBody = document.getElementById('devicesBody');
    const messageEl = document.getElementById('message');
    const licenseStats = document.getElementById('licenseStats');
    const logoutBtn = document.getElementById('logoutBtn');

    let licenses = [];
    let selectedLicenseId = null;

    function setMessage(text, isError) {
        messageEl.style.color = isError ? '#fda4af' : '#86efac';
        messageEl.textContent = text || '';
    }

    async function apiRequest(path, options) {
        const response = await fetch(path, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...(options && options.headers ? options.headers : {})
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('licenseAdminToken');
            window.location.replace('/admin/login');
            return null;
        }

        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Request failed');
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
        if (licenses.length === 0) {
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
                        <button class="btn btn-primary" onclick="window.__approveDevice(${device.id})">Approve</button>
                        <button class="btn btn-danger" onclick="window.__revokeDevice(${device.id})">Revoke</button>
                    </td>
                </tr>
            `;
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

    async function loadLicenses() {
        setMessage('', false);
        const payload = await apiRequest('/admin/licenses');
        if (!payload) return;
        licenses = Array.isArray(payload.data) ? payload.data : [];
        renderLicenseSelect();
        renderStats();
        await loadDevices();
    }

    async function loadDevices() {
        if (!selectedLicenseId) {
            devicesBody.innerHTML = '<tr><td colspan="9" class="muted">No license selected.</td></tr>';
            return;
        }

        const payload = await apiRequest(`/admin/licenses/${selectedLicenseId}/devices`);
        if (!payload) return;
        renderDevices(Array.isArray(payload.data) ? payload.data : []);
    }

    window.__approveDevice = async function approveDevice(deviceId) {
        try {
            await apiRequest(`/admin/devices/${deviceId}/approve`, { method: 'POST', body: '{}' });
            setMessage('Device approved.', false);
            await loadLicenses();
        } catch (error) {
            setMessage(error.message, true);
        }
    };

    window.__revokeDevice = async function revokeDevice(deviceId) {
        try {
            await apiRequest(`/admin/devices/${deviceId}/revoke`, { method: 'POST', body: '{}' });
            setMessage('Device revoked.', false);
            await loadLicenses();
        } catch (error) {
            setMessage(error.message, true);
        }
    };

    licenseSelect.addEventListener('change', async () => {
        selectedLicenseId = Number.parseInt(licenseSelect.value, 10) || null;
        renderStats();
        await loadDevices();
    });

    refreshLicensesBtn.addEventListener('click', async () => {
        try {
            await loadLicenses();
            setMessage('Licenses refreshed.', false);
        } catch (error) {
            setMessage(error.message, true);
        }
    });

    resetDevicesBtn.addEventListener('click', async () => {
        if (!selectedLicenseId) return;
        try {
            await apiRequest(`/admin/licenses/${selectedLicenseId}/reset`, { method: 'POST', body: '{}' });
            setMessage('License devices reset.', false);
            await loadLicenses();
        } catch (error) {
            setMessage(error.message, true);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await apiRequest('/admin/auth/logout', { method: 'POST', body: '{}' });
        } catch (_) {
            // no-op
        }
        localStorage.removeItem('licenseAdminToken');
        window.location.replace('/admin/login');
    });

    loadLicenses().catch((error) => setMessage(error.message, true));
})();
