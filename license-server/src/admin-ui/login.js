if (!window.__licenseAdminLoginBootstrapped) {
    window.__licenseAdminLoginBootstrapped = true;
    document.addEventListener('DOMContentLoaded', () => {
    console.info('[license-admin-ui] login.js loaded');

    const TOKEN_KEY = 'licenseAdminToken';
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorEl = document.getElementById('error');
    const protocolWarningEl = document.getElementById('protocolWarning');

    function setError(message) {
        errorEl.textContent = message || '';
    }

    function setLoading(loading) {
        submitBtn.disabled = loading;
        submitBtn.textContent = loading ? 'Signing In...' : 'Sign In';
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

    if (isFileProtocol()) {
        if (protocolWarningEl) {
            protocolWarningEl.style.display = 'block';
        }
        setError('Open the admin panel via http://localhost:4000/admin/login (not file://).');
        form.querySelectorAll('input, button').forEach((el) => { el.disabled = true; });
        return;
    }

    const existingToken = getToken();
    if (existingToken) {
        window.location.replace('/admin');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('error');
    if (errorCode === 'SESSION_EXPIRED') {
        setError('Session expired. Please sign in again.');
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            let payload = null;
            try {
                payload = await response.json();
            } catch (_) {
                payload = null;
            }

            if (!response.ok || !payload?.success || !payload?.token) {
                const code = payload?.code || `HTTP_${response.status}`;
                const message = payload?.message || 'Login failed';
                setError(`${code}: ${message}`);
                setLoading(false);
                return;
            }

            saveToken(payload.token);
            window.location.replace('/admin');
        } catch (error) {
            console.error('[license-admin-ui] login request failed', error);
            setError('Unable to connect to license server');
            setLoading(false);
        }
    });
    });
}
