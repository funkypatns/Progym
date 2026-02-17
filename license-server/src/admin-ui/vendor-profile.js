(function () {
    const token = localStorage.getItem('licenseAdminToken');
    if (!token) {
        window.location.replace('/admin/login');
        return;
    }

    const form = document.getElementById('vendorForm');
    const messageEl = document.getElementById('message');
    const previewEl = document.getElementById('preview');
    const metaEl = document.getElementById('meta');
    const saveBtn = document.getElementById('saveBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const fields = {
        displayName: document.getElementById('displayName'),
        phone: document.getElementById('phone'),
        whatsapp: document.getElementById('whatsapp'),
        email: document.getElementById('email'),
        website: document.getElementById('website'),
        supportHours: document.getElementById('supportHours'),
        whatsappTemplate: document.getElementById('whatsappTemplate')
    };

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

    async function loadProfile() {
        const payload = await apiRequest('/admin/vendor-profile');
        if (!payload) return;
        setFormValues(payload.data || {});
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage('', false);
        saveBtn.disabled = true;

        try {
            const values = readFormValues();
            const payload = await apiRequest('/admin/vendor-profile', {
                method: 'PUT',
                body: JSON.stringify(values)
            });
            setFormValues(payload.data || values);
            setMessage('Vendor profile saved.', false);
        } catch (error) {
            setMessage(error.message || 'Failed to save vendor profile.', true);
        } finally {
            saveBtn.disabled = false;
        }
    });

    Object.values(fields).forEach((field) => {
        field.addEventListener('input', () => {
            renderPreview(readFormValues());
        });
    });

    reloadBtn.addEventListener('click', async () => {
        try {
            await loadProfile();
            setMessage('Profile reloaded.', false);
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

    loadProfile().catch((error) => setMessage(error.message, true));
})();
