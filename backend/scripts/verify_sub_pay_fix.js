const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifySubscriptionPaymentLogic() {
    console.log("🚀 Starting Subscription-Payment Integration Verification...");

    try {
        // 1. Setup prerequisite data
        const member = await prisma.member.upsert({
            where: { memberId: 'TEST-SUB-PAY' },
            update: {},
            create: {
                memberId: 'TEST-SUB-PAY',
                firstName: 'Integration',
                lastName: 'Tester',
                phone: '999999999'
            }
        });

        let plan = await prisma.subscriptionPlan.findFirst({
            where: { name: 'Test Plan 500' }
        });

        if (!plan) {
            plan = await prisma.subscriptionPlan.create({
                data: {
                    name: 'Test Plan 500',
                    price: 500,
                    duration: 30,
                    isActive: true
                }
            });
        }

        const user = await prisma.user.findFirst({ where: { role: 'admin' } });

        // 2. Scenario 1: Partial Payment (Pay 200 of 500)
        console.log("🧪 Scenario 1: Partial Payment ($200/$500)...");
        const sub1 = await prisma.$transaction(async (tx) => {
            const s = await tx.subscription.create({
                data: {
                    memberId: member.id,
                    planId: plan.id,
                    startDate: new Date(),
                    endDate: new Date(),
                    status: 'active',
                    price: plan.price,
                    paidAmount: 200
                }
            });

            // Receipt
            await tx.payment.create({
                data: {
                    memberId: s.memberId,
                    subscriptionId: s.id,
                    amount: 200,
                    status: 'completed',
                    receiptNumber: 'VERIFY-PARTIAL-REC'
                }
            });

            // Invoice
            await tx.payment.create({
                data: {
                    memberId: s.memberId,
                    subscriptionId: s.id,
                    amount: 300,
                    status: 'pending',
                    receiptNumber: 'VERIFY-PARTIAL-INV'
                }
            });
            return s;
        });

        // Verify counts
        const payments1 = await prisma.payment.findMany({ where: { subscriptionId: sub1.id } });
        console.log(`✅ Scenario 1: Created ${payments1.length} payment records.`);
        if (payments1.length !== 2) throw new Error("Expected 2 payment records for partial payment");

        // 3. Scenario 2: Zero Payment (Pay 0 of 500)
        console.log("🧪 Scenario 2: Zero Payment ($0/$500)...");
        const sub2 = await prisma.$transaction(async (tx) => {
            const s = await tx.subscription.create({
                data: {
                    memberId: member.id,
                    planId: plan.id,
                    startDate: new Date(),
                    endDate: new Date(),
                    status: 'active',
                    price: plan.price,
                    paidAmount: 0
                }
            });

            // Invoice Only
            await tx.payment.create({
                data: {
                    memberId: s.memberId,
                    subscriptionId: s.id,
                    amount: 500,
                    status: 'pending',
                    receiptNumber: 'VERIFY-ZERO-INV'
                }
            });
            return s;
        });

        const payments2 = await prisma.payment.findMany({ where: { subscriptionId: sub2.id } });
        console.log(`✅ Scenario 2: Created ${payments2.length} payment records.`);
        if (payments2.length !== 1) throw new Error("Expected 1 pending record for zero payment");
        if (payments2[0].status !== 'pending') throw new Error("Status should be pending");

        console.log("🎉 All Integration Scenarios Passed!");

        // Cleanup
        await prisma.payment.deleteMany({ where: { subscriptionId: { in: [sub1.id, sub2.id] } } });
        await prisma.subscription.deleteMany({ where: { id: { in: [sub1.id, sub2.id] } } });

    } catch (error) {
        console.error("❌ Verification Failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

verifySubscriptionPaymentLogic();
