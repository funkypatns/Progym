import axios from 'axios';

function normalizeBaseUrl(value) {
    const fallback = 'http://localhost:4000';
    const raw = String(value || fallback).trim();
    return raw.replace(/\/+$/, '');
}

const publicLicenseApi = axios.create({
    baseURL: normalizeBaseUrl(import.meta.env.VITE_LICENSE_SERVER_BASE_URL),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export default publicLicenseApi;
