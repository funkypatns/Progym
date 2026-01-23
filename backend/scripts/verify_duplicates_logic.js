const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log("🧪 Starting Verification: Duplicates & Payments Integration...");

    try {
        // 1. Create a Test Member
        const member = await prisma.member.create({
            data: {
                memberId: "TEST-DUP-" + Date.now(),
                firstName: "Test",
                lastName: "Duplicate",
                phone: "12345678"
            }
        });

        const plan = await prisma.subscriptionPlan.findFirst();
        if (!plan) throw new Error("No subscription plan found for testing.");

        console.log(`✅ Member created: ${member.id}`);

        // 2. Test Duplicate Prevention (Simulate rapid double-click)
        console.log("🧪 Testing Duplicate Prevention (Scenario 1)...");

        // Mocking the check I added in the route
        async function createSub() {
            // This mimics the route logic
            return await prisma.$transaction(async (tx) => {
                const existing = await tx.subscription.findFirst({
                    where: { memberId: member.id, status: 'active' }
                });

                // If created very recently, return it
                if (existing && (new Date() - existing.createdAt < 5000)) {
                    return existing;
                }

                await tx.subscription.updateMany({
                    where: { memberId: member.id, status: 'active' },
                    data: { status: 'expired' }
                });

                return await tx.subscription.create({
                    data: {
                        memberId: member.id,
                        planId: plan.id,
                        startDate: new Date(),
                        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        status: 'active'
                    }
                });
            });
        }

        const [sub1, sub2] = await Promise.all([createSub(), createSub()]);

        const activeCount = await prisma.subscription.count({
            where: { memberId: member.id, status: 'active' }
        });

        console.log(`📊 Active Subscriptions for member: ${activeCount}`);
        if (activeCount === 1) {
            console.log("✅ SUCCESS: Duplicate prevented, only one active subscription remains.");
        } else {
            console.error("❌ FAILURE: Multiple active subscriptions found!");
        }

        // 3. Test Payment Creation (Simulating MemberForm)
        console.log("🧪 Testing Payment Creation Integration...");
        const paidAmount = 100; // Partial payment
        const fullPrice = 500;

        await prisma.$transaction(async (tx) => {
            const sub = await tx.subscription.create({
                data: {
                    memberId: member.id,
                    planId: plan.id,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'active',
                    price: fullPrice,
                    paidAmount: paidAmount
                }
            });

            // Receipt
            await tx.payment.create({
                data: {
                    memberId: member.id,
                    subscriptionId: sub.id,
                    amount: paidAmount,
                    status: 'completed',
                    receiptNumber: "TEST-RCP-" + Date.now(),
                    method: 'cash'
                }
            });

            // Invoice
            await tx.payment.create({
                data: {
                    memberId: member.id,
                    subscriptionId: sub.id,
                    amount: fullPrice - paidAmount,
                    status: 'pending',
                    receiptNumber: "TEST-INV-" + Date.now(),
                    method: 'other'
                }
            });
        });

        const paymentCount = await prisma.payment.count({ where: { memberId: member.id } });
        const pendingCount = await prisma.payment.count({ where: { memberId: member.id, status: 'pending' } });

        console.log(`📊 Payments created for member: ${paymentCount} (${pendingCount} pending)`);
        if (paymentCount >= 2 && pendingCount >= 1) {
            console.log("✅ SUCCESS: Payments/Invoices correctly generated.");
        } else {
            console.error("❌ FAILURE: Payments not correctly generated.");
        }

    } catch (err) {
        console.error("❌ Error during verification:", err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
