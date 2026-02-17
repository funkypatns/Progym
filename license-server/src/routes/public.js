const express = require('express');
const { VendorProfileModel } = require('../database');

const router = express.Router();

const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.PUBLIC_VENDOR_PROFILE_RATE_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.PUBLIC_VENDOR_PROFILE_RATE_MAX || '120', 10);
const rateState = new Map();

function getRequestIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function applyLightRateLimit(req, res, next) {
    const now = Date.now();
    const ip = getRequestIp(req);
    const state = rateState.get(ip);

    if (!state || (now - state.windowStartAt) >= RATE_LIMIT_WINDOW_MS) {
        rateState.set(ip, { count: 1, windowStartAt: now });
        return next();
    }

    if (state.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({
            success: false,
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please retry shortly.'
        });
    }

    state.count += 1;
    rateState.set(ip, state);
    return next();
}

function mapVendorProfile(profile) {
    return {
        displayName: profile?.display_name || null,
        phone: profile?.phone || null,
        whatsapp: profile?.whatsapp || null,
        email: profile?.email || null,
        website: profile?.website || null,
        supportHours: profile?.support_hours || null,
        whatsappTemplate: profile?.whatsapp_template || null,
        updatedAt: profile?.updated_at || null,
        version: Number.isInteger(profile?.version) ? profile.version : 1
    };
}

router.get('/vendor-profile', applyLightRateLimit, (req, res) => {
    try {
        const profile = VendorProfileModel.get();
        return res.json({
            success: true,
            data: mapVendorProfile(profile)
        });
    } catch (error) {
        console.error('[PUBLIC] Vendor profile fetch error:', error);
        return res.status(500).json({
            success: false,
            code: 'VENDOR_PROFILE_FETCH_ERROR',
            message: 'Failed to fetch vendor profile'
        });
    }
});

module.exports = router;
