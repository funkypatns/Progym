(function () {
    const token = localStorage.getItem('licenseAdminToken');
    if (token) {
        window.location.replace('/admin');
        return;
    }

    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorEl = document.getElementById('error');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorEl.textContent = '';
        submitBtn.disabled = true;

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const payload = await response.json();

            if (!response.ok || !payload.success || !payload.token) {
                errorEl.textContent = payload.message || 'Login failed';
                submitBtn.disabled = false;
                return;
            }

            localStorage.setItem('licenseAdminToken', payload.token);
            window.location.replace('/admin');
        } catch (_) {
            errorEl.textContent = 'Unable to connect to license server';
            submitBtn.disabled = false;
        }
    });
})();
