/* eslint-disable no-console */
/**
 * VERIFICATION SCRIPT
 * Tests Prorated Cancellation & Strict Refund Policy
 * 
 * Usage: node scripts/verify-cancellation.js
 * Make sure the backend server is running on port 5000!
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// Use native fetch (Node 18+)
const fetch = global.fetch;

const BASE_URL = 'http://localhost:5000/api';
const EMAIL = `admin_test_${Date.now()}@example.com`;
const PASSWORD = 'password123';

async function main() {
    console.log('🚀 Starting Verification Script...');

    try {
        // 1. Create Admin User directly in DB
        console.log('1️⃣ Creating Test Admin...');
        const hashedPassword = await bcrypt.hash(PASSWORD, 10);

        const admin = await prisma.user.create({
            data: {
                username: `admintest${Date.now()}`,
                email: EMAIL,
                password: hashedPassword,
                firstName: 'Test',
                lastName: 'Admin',
                role: 'admin',
                permissions: JSON.stringify(['payments.refund.goodwill', 'subscriptions.view', 'subscriptions.create', 'payments.view', 'payments.create'])
            }
        });

        // 2. Login
        console.log('2️⃣ Logging in...');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        const loginData = await loginRes.json();
        if (!loginData.token) throw new Error('Login failed: ' + JSON.stringify(loginData));
        const token = loginData.token;
        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        console.log('✅ Logged in.');

        // 3. Create Plan
        console.log('3️⃣ Creating 30-day Plan ($300)...');
        const plan = await prisma.subscriptionPlan.create({
            data: { name: `TestPlan_${Date.now()}`, price: 300, duration: 30 }
        });

        // 4. Create Member
        console.log('4️⃣ Creating Member...');
        const member = await prisma.member.create({
            data: {
                memberId: `TM-${Date.now()}`,
                firstName: 'John',
                lastName: 'Doe',
                phone: `555${Date.now()}`
            }
        });

        // 5. Create Subscription (Active)
        // Start date = 10 days ago (for usage calc)
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        console.log('5️⃣ Creating Subscription (started 10 days ago)...');

        // Create Sub via DB
        const sub = await prisma.subscription.create({
            data: {
                memberId: member.id,
                planId: plan.id,
                startDate: tenDaysAgo,
                endDate: new Date(tenDaysAgo.getTime() + 30 * 24 * 60 * 60 * 1000),
                status: 'active',
                price: 300,
                paidAmount: 300,
                usedNonRefundableAmount: 0
            }
        });

        // Create Payment via DB (needed for refund context)
        // Ensure Machine and Shift exist
        let machine = await prisma.pOSMachine.findFirst();
        if (!machine) machine = await prisma.pOSMachine.create({ data: { name: 'TestPOS', machineKey: `key_${Date.now()}` } });

        const shift = await prisma.pOSShift.create({
            data: {
                machineId: machine.id,
                openedBy: admin.id,
                openingCash: 100,
                status: 'open'
            }
        });

        const payment = await prisma.payment.create({
            data: {
                memberId: member.id,
                subscriptionId: sub.id,
                amount: 300,
                method: 'cash',
                status: 'completed',
                receiptNumber: `RCP-${Date.now()}`,
                shiftId: shift.id,
                createdBy: admin.id
            }
        });

        // ==========================================
        // CASE A: Preview & Prorated Cancel
        // ==========================================
        console.log('\n--- CASE A: Prorated Cancel ---');

        // 6. Preview
        console.log('🔍 Fetching Preview...');
        const previewRes = await fetch(`${BASE_URL}/subscriptions/${sub.id}/preview-cancel`, { headers });
        const previewJson = await previewRes.json();

        if (!previewJson.success) throw new Error('Preview failed: ' + JSON.stringify(previewJson));
        const preview = previewJson.data;

        console.log('Preview Data:', preview);

        // Expected: 
        // 10 days used. 
        // Price: 300. Daily: 10.
        // Used: 100. Refundable: 200.
        if (Math.abs(preview.usedAmount - 100) > 1) console.error('❌ Mismatch in Used Amount (Expected ~100)', preview.usedAmount);
        else console.log('✅ Used Amount correct (~100).');

        if (Math.abs(preview.refundableAmount - 200) > 1) console.error('❌ Mismatch in Refundable (Expected ~200)', preview.refundableAmount);
        else console.log('✅ Refundable Amount correct (~200).');

        // 7. Execute Cancel
        console.log('⚡ Executor Cancel (Prorated)...');
        const cancelRes = await fetch(`${BASE_URL}/subscriptions/${sub.id}/cancel`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ type: 'prorated' })
        });
        const cancelJson = await cancelRes.json();

        if (!cancelJson.success) throw new Error('Cancel failed: ' + cancelJson.message);
        console.log('Cancel Result:', cancelJson.message);

        // Verify DB State
        const updatedSub = await prisma.subscription.findUnique({ where: { id: sub.id } });
        console.log(`Updated Sub Status: ${updatedSub.status}`);

        if (updatedSub.status !== 'cancelled') console.error('❌ Status not cancelled');
        else console.log('✅ Status is cancelled.');

        if (updatedSub.usedNonRefundableAmount < 99) console.error('❌ UsedNonRefundable not set', updatedSub.usedNonRefundableAmount);
        else console.log('✅ UsedNonRefundable set correctly.');

        // Check Refund
        const refunds = await prisma.refund.findMany({ where: { paymentId: payment.id } });
        console.log(`Refunds found: ${refunds.length}`);

        if (refunds.length === 0) console.error('❌ No refund created');
        else if (Math.abs(refunds[0].amount - 200) > 1) console.error('❌ Refund amount incorrect', refunds[0].amount);
        else console.log('✅ Refund record correct.');

        // ==========================================
        // CASE B: Strict Refund Policy (Attempt to refund consumed amount)
        // ==========================================
        console.log('\n--- CASE B: Strict Refund Policy ---');
        // Remaining Balance on Payment should be 0?
        // Paid: 300. Refunded: 200. Used: 100.
        // Refundable Balance: 300 - 200 - 100 = 0.
        // Attempt to refund 10.

        console.log('Attempting standard refund of 10 (Should Fail)...');
        const failRefundRes = await fetch(`${BASE_URL}/payments/${payment.id}/refund`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: 10, reason: 'Illegal Refund' })
        });
        const failRefundJson = await failRefundRes.json();

        if (failRefundJson.success) console.error('❌ Refund succeeded but should have failed!');
        else console.log(`✅ Refund blocked as expected. Message: ${failRefundJson.message}`);

        // ==========================================
        // CASE C: Goodwill Refund
        // ==========================================
        console.log('\n--- CASE C: Goodwill Refund ---');
        // Attempt with goodwill: true
        console.log('Attempting Goodwill refund of 50 (Should Succeed)...');
        const goodwillRes = await fetch(`${BASE_URL}/payments/${payment.id}/refund`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ amount: 50, reason: 'Customer unhappy', goodwill: true })
        });
        const goodwillJson = await goodwillRes.json();

        if (!goodwillJson.success) console.error('❌ Goodwill refund failed: ' + goodwillJson.message);
        else console.log('✅ Goodwill refund succeeded.');

        // Verify final totals
        // Paid: 300. 
        // Refund 1 (Prorated): 200.
        // Refund 2 (Goodwill): 50.
        // Total Refunded: 250.
        // Net Retained: 50.

        const finalPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
        console.log(`Final Refunded Total: ${finalPayment.refundedTotal}`);

        if (Math.abs(finalPayment.refundedTotal - 250) > 1) console.error('❌ Final refunded total mismatch');
        else console.log('✅ Final financials correct.');

        console.log('\n✨ VERIFICATION COMPLETE ✨');

    } catch (err) {
        console.error('CRITICAL FAILURE:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
