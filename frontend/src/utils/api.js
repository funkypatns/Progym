/**
 * ============================================
 * AXIOS API CONFIGURATION
 * ============================================
 */

import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance
const api = axios.create({
    // Production: Use VITE_API_BASE_URL from environment
    // Development: Use proxy via relative path
    baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Offline Guard State
let isBackendOffline = false;

// Toast Debouncing: Prevent same error message from spamming
const toastDebounceCache = new Map();
const TOAST_DEBOUNCE_MS = 5000; // 5 seconds

const debouncedToast = (message, options = {}) => {
    const now = Date.now();
    const lastShown = toastDebounceCache.get(message);

    if (lastShown && (now - lastShown) < TOAST_DEBOUNCE_MS) {
        // Skip toast, already shown recently
        return;
    }

    toastDebounceCache.set(message, now);
    toast.error(message, options);

    // Cleanup old entries (memory leak prevention)
    if (toastDebounceCache.size > 50) {
        const entries = Array.from(toastDebounceCache.entries());
        entries.slice(0, 25).forEach(([key]) => toastDebounceCache.delete(key));
    }
};

// Request interceptor
api.interceptors.request.use(
    (config) => {
        // Network Guard: Prevent spam if backend is confirmed offline
        if (isBackendOffline) {
            // Optional: You could reject here immediately, but usually we let one probe go through
            // to see if it's back. For "infinite spam", we need to throttle toast.
        }

        // Get token from localStorage
        const authData = localStorage.getItem('auth-storage');
        if (authData) {
            try {
                const { state } = JSON.parse(authData);
                if (state?.token) {
                    config.headers.Authorization = `Bearer ${state.token}`;
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        // If we get a response, backend is online
        if (isBackendOffline) {
            isBackendOffline = false;
            console.log('✅ Backend is back online');
        }
        return response;
    },
    (error) => {
        // Handle network errors (backend down / CORS)
        if (!error.response) {
            console.error('🌐 Network Error / Backend unreachable:', error);

            if (!isBackendOffline) {
                isBackendOffline = true;
                toast.error('Cannot connect to server. Retrying...', { id: 'offline-toast' });

                setTimeout(() => { isBackendOffline = false; }, 10000);
            }

            error.message = 'Backend offline or unreachable.';
            return Promise.reject(error);
        }

        const status = error.response.status;
        const message = error.response.data?.message || 'Something went wrong';

        // 401: Unauthorized (Session expired)
        if (status === 401) {
            // EXCLUSION: Do not logout on non-critical/polling endpoints
            const isPollingEndpoint =
                error.config.url.includes('/unack-count') ||
                error.config.url.includes('/status') ||
                error.config.url.includes('/hardware-id');

            if (!isPollingEndpoint && !window.location.pathname.includes('/login')) {
                debouncedToast('Session expired. Please login again.');
                localStorage.removeItem('auth-storage');
                setTimeout(() => { window.location.href = '/login'; }, 1000);
            }
        }
        // 403: Forbidden
        else if (status === 403) {
            debouncedToast(message || 'Permission denied');
            // Dispatch event for App to refresh permissions (but not if we're already refreshing session)
            if (!error.config.url.includes('/auth/me')) {
                window.dispatchEvent(new Event('auth:forbidden'));
            }
        }
        // 400: Bad Request (Validation)
        else if (status === 400) {
            debouncedToast(message);
        }
        // 500+: Server Errors
        else if (status >= 500) {
            console.error('🔥 Server Error:', error.response.data);
            debouncedToast('Server error. The developers have been notified.');
            error.message = 'Internal server error.';
        }

        // Return error object with formatted message for components to consume if needed
        error.message = message;
        return Promise.reject(error);
    }
);

export default api;
