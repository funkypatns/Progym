const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001/api';
const USERNAME = process.env.ADMIN_USER || 'admin';
const PASSWORD = process.env.ADMIN_PASS || 'admin123';
const MACHINE_KEY = process.env.MACHINE_KEY || `SMOKE-${Date.now()}`;

const METHODS = ['cash', 'card', 'transfer'];

const buildMemberPayload = (suffix) => ({
    firstName: 'Smoke',
    lastName: `Member${suffix}`,
    phone: `01${String(Date.now()).slice(-9)}`,
    email: `smoke_${suffix}@example.com`,
    gender: 'male'
});

const logStep = (message) => {
    console.log(message);
};

async function login() {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
        username: USERNAME,
        password: PASSWORD
    });
    const { token, user } = res.data.data;
    return { token, user };
}

async function ensureShift(headers) {
    let openedShiftId = null;
    let machineId = null;

    const statusRes = await axios.get(`${BASE_URL}/pos/status`, {
        headers,
        params: { machineKey: MACHINE_KEY }
    });

    machineId = statusRes.data.data.machine?.id;

    if (!machineId) {
        throw new Error('Failed to resolve POS machine ID');
    }

    try {
        const openRes = await axios.post(`${BASE_URL}/pos/shift/open`, {
            machineId,
            openingCash: 0
        }, { headers });
        openedShiftId = openRes.data.data.id;
        logStep(`✅ Shift opened (ID: ${openedShiftId})`);
    } catch (err) {
        logStep(`ℹ️ Shift open skipped: ${err.response?.data?.message || err.message}`);
    }

    return { openedShiftId };
}

async function createMember(headers, suffix) {
    const payload = buildMemberPayload(suffix);
    const res = await axios.post(`${BASE_URL}/members`, payload, { headers });
    return res.data.data;
}

async function assignSubscription(headers, memberId, plan, method) {
    const paidAmount = Number(plan.price);
    const payload = {
        memberId,
        planId: plan.id,
        startDate: new Date().toISOString(),
        paidAmount,
        paymentStatus: 'paid',
        method
    };

    if (method !== 'cash') {
        payload.transactionRef = `SMOKE-${method.toUpperCase()}-${Date.now()}`;
    }

    const res = await axios.post(`${BASE_URL}/subscriptions`, payload, { headers });
    return res.data.data;
}

async function main() {
    logStep('🚀 Smoke test: member + subscription flows');
    logStep(`🔗 API: ${BASE_URL}`);

    const { token, user } = await login();
    const headers = { Authorization: `Bearer ${token}` };
    logStep(`✅ Logged in as ${user.firstName} (${user.username})`);

    const { openedShiftId } = await ensureShift(headers);

    const plansRes = await axios.get(`${BASE_URL}/plans?active=true`, { headers });
    const plans = plansRes.data.data || [];
    const plan = plans[0];

    if (!plan) {
        throw new Error('No active plans available to run smoke tests');
    }

    logStep(`✅ Using plan: ${plan.name} (${plan.price})`);

    for (const method of METHODS) {
        const suffix = `${method}-${Date.now()}`;
        logStep(`➡️ Creating member + subscription (${method})`);
        const member = await createMember(headers, suffix);
        const subscription = await assignSubscription(headers, member.id, plan, method);
        logStep(`✅ ${method} OK: member ${member.id}, subscription ${subscription.id}`);
    }

    if (openedShiftId) {
        try {
            await axios.post(`${BASE_URL}/pos/shift/close`, {
                shiftId: openedShiftId,
                closingCash: 0
            }, { headers });
            logStep(`✅ Shift closed (ID: ${openedShiftId})`);
        } catch (err) {
            logStep(`⚠️ Shift close failed: ${err.response?.data?.message || err.message}`);
        }
    }

    logStep('🎉 Smoke test completed');
}

main().catch((err) => {
    console.error('❌ Smoke test failed:', err.response?.data?.message || err.message);
    if (err.response?.data) {
        console.error(JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
});
