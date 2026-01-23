const axios = require('axios');

// CONFIG
const BASE_URL = 'http://localhost:5000/api'; // Adjust port if needed
const ADMIN_USER = { username: 'admin', password: 'password123' }; // Adjust credentials

async function reproduce() {
    console.log("🚀 Starting E2E API Reproduction...");

    try {
        // 1. Login
        console.log("1. Logging in...");
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, ADMIN_USER);
        const { token, user } = loginRes.data.data;
        const headers = { Authorization: `Bearer ${token}` };
        console.log("✅ Logged in as:", user.firstName);

        // 2. Open Shift (if not open)
        console.log("2. Checking/Opening Shift...");
        // For simplicity, try to open, if fail (400), assume open.
        try {
            await axios.post(`${BASE_URL}/pos/shift/open`, { openingCash: 100 }, { headers });
            console.log("✅ Shift Opened.");
        } catch (e) {
            console.log("ℹ️ Shift likely already open or error:", e.response?.data?.message);
        }

        // 3. Create Member
        console.log("3. Creating Member...");
        const memberPayload = {
            firstName: "TestAPI",
            lastName: "User" + Date.now(),
            phone: Date.now().toString(),
            gender: "male",
            memberId: "MEM-" + Date.now()
        };
        const memberRes = await axios.post(`${BASE_URL}/members`, memberPayload, { headers });
        const memberId = memberRes.data.data.id;
        console.log("✅ Member Created:", memberId);

        // 4. Get Plan
        const plansRes = await axios.get(`${BASE_URL}/plans`, { headers });
        const plan = plansRes.data.data[0];
        if (!plan) throw new Error("No plans found");
        console.log("ℹ️ Using Plan:", plan.name, "Price:", plan.price);

        // 5. Create Subscription (Use payload exactly like Frontend)
        console.log("4. Creating Subscription...");
        const subPayload = {
            memberId: memberId,
            planId: plan.id,
            startDate: new Date().toISOString(),
            // Mimic AssignPlanModal payload
            paymentStatus: 'paid',
            paidAmount: plan.price,
            method: 'cash',
            notes: 'E2E Test'
        };

        const subRes = await axios.post(`${BASE_URL}/subscriptions`, subPayload, { headers });
        const subId = subRes.data.data.id;
        console.log("✅ Subscription Created:", subId);

        // 6. Check Payments
        console.log("5. Checking Payments...");
        const paymentsRes = await axios.get(`${BASE_URL}/payments?limit=100`, { headers });
        const payments = paymentsRes.data.data.payments || [];

        const myPayment = payments.find(p => p.subscription?.id === subId);

        if (myPayment) {
            console.log("✅ SUCCESS: Payment found for subscription!");
            console.log("   - Receipt:", myPayment.receiptNumber);
            console.log("   - Amount:", myPayment.amount);
            console.log("   - Status:", myPayment.status);
            console.log("   - ShiftId:", myPayment.shiftId);
        } else {
            console.error("❌ FAILURE: No payment found for this subscription.");
            console.log("Debug: Dumping last 3 payments...");
            payments.slice(0, 3).forEach(p => console.log(JSON.stringify(p, null, 2)));
        }

    } catch (e) {
        console.error("❌ ERROR:", e.message);
        if (e.response) {
            console.error("   Status:", e.response.status);
            console.error("   Data:", JSON.stringify(e.response.data, null, 2));
        }
    }
}

reproduce();
