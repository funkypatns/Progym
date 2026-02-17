if (!window.__licenseAdminVendorBootstrapped) {
    window.__licenseAdminVendorBootstrapped = true;
    document.addEventListener('DOMContentLoaded', () => {
    console.info('[license-admin-ui] vendor-profile.js loaded');

    const TOKEN_KEY = 'licenseAdminToken';
    const form = document.getElementById('vendorForm');
    const messageEl = document.getElementById('message');
    const previewEl = document.getElementById('preview');
    const metaEl = document.getElementById('meta');
    const saveBtn = document.getElementById('saveBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const protocolWarningEl = document.getElementById('protocolWarning');

    const fields = {
        displayName: document.getElementById('displayName'),
        phone: document.getElementById('phone'),
        whatsapp: document.getElementById('whatsapp'),
        email: document.getElementById('email'),
        website: document.getElementById('website'),
        supportHours: document.getElementById('supportHours'),
        whatsappTemplate: document.getElementById('whatsappTemplate')
    };

    let isBusy = false;

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

    function setBusy(nextBusy) {
        isBusy = nextBusy;
        saveBtn.disabled = nextBusy;
        reloadBtn.disabled = nextBusy;
        logoutBtn.disabled = nextBusy;
        saveBtn.textContent = nextBusy ? 'Saving...' : 'Save';
    }

    function setMessage(text, isError) {
        messageEl.style.color = isError ? '#fda4af' : '#86efac';
        messageEl.textContent = text || '';
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString();
    }

    function renderMeta(profile) {
        metaEl.textContent = `Last updated: ${formatDate(profile.updatedAt)} | Updated by: ${profile.updatedBy || '-'}`;
    }

    function renderPreview(profile) {
        const template = (profile.whatsappTemplate || '').trim();
        const sampleMessage = template
            ? template
                .replace(/\{licenseKey\}/g, 'GYM-XXXX-XXXX-XXXX')
                .replace(/\{gymName\}/g, 'Sample Gym')
            : '-';

        previewEl.innerHTML = `
            <div><strong>تم تطوير النظام بواسطة</strong> ${profile.displayName || '-'}</div>
            <div><strong>Phone:</strong> ${profile.phone || '-'}</div>
            <div><strong>WhatsApp:</strong> ${profile.whatsapp || '-'}</div>
            <div><strong>Email:</strong> ${profile.email || '-'}</div>
            <div><strong>Website:</strong> ${profile.website ? `<a class="link" href="${profile.website}" target="_blank" rel="noopener noreferrer">${profile.website}</a>` : '-'}</div>
            <div><strong>Support Hours:</strong> ${profile.supportHours || '-'}</div>
            <div style="margin-top:8px;"><strong>WhatsApp Message Preview:</strong><br />${sampleMessage || '-'}</div>
        `;
    }

    function setFormValues(profile) {
        Object.keys(fields).forEach((key) => {
            if (!fields[key]) return;
            fields[key].value = profile[key] || '';
        });
        renderMeta(profile);
        renderPreview(profile);
    }

    function readFormValues() {
        return {
            displayName: fields.displayName.value,
            phone: fields.phone.value,
            whatsapp: fields.whatsapp.value,
            email: fields.email.value,
            website: fields.website.value,
            supportHours: fields.supportHours.value,
            whatsappTemplate: fields.whatsappTemplate.value
        };
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

    async function loadProfile() {
        const payload = await apiRequest('/api/admin/vendor-profile');
        if (!payload) return;
        setFormValues(payload.data || {});
    }

    if (window.location.protocol === 'file:') {
        if (protocolWarningEl) {
            protocolWarningEl.style.display = 'block';
        }
        setMessage('Open this page from http://localhost:4000/admin/vendor-profile (not file://).', true);
        form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = true; });
        logoutBtn.disabled = true;
        return;
    }

    if (!getToken()) {
        window.location.replace('/admin/login?error=SESSION_EXPIRED');
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isBusy) return;
        setMessage('', false);
        try {
            setBusy(true);
            const values = readFormValues();
            const payload = await apiRequest('/api/admin/vendor-profile', {
                method: 'PUT',
                body: JSON.stringify(values)
            });
            setFormValues(payload?.data || values);
            setMessage('Vendor profile saved.', false);
        } catch (error) {
            console.error('[license-admin-ui] save vendor profile failed', error);
            setMessage(error.message || 'Failed to save vendor profile.', true);
        } finally {
            setBusy(false);
        }
    });

    Object.values(fields).forEach((field) => {
        field.addEventListener('input', () => {
            renderPreview(readFormValues());
        });
    });

    reloadBtn.addEventListener('click', async () => {
        if (isBusy) return;
        try {
            setBusy(true);
            await loadProfile();
            setMessage('Profile reloaded.', false);
        } catch (error) {
            console.error('[license-admin-ui] reload vendor profile failed', error);
            setMessage(error.message, true);
        } finally {
            setBusy(false);
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

    loadProfile().catch((error) => {
        console.error('[license-admin-ui] initial vendor profile load failed', error);
        setMessage(error.message, true);
    });
    });
}
