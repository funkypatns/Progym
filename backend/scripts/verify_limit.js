/**
 * Verification script for Payment Overpayment Validation
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('🚀 Starting Payment Validation Verification...');

    try {
        // 1. Setup Dummy Data
        console.log('📝 Creating dummy member and subscription...');

        const memberId = `VAL-${Date.now()}`;
        const member = await prisma.member.create({
            data: {
                memberId,
                firstName: 'Validation',
                lastName: 'Tester',
                phone: '555-0000'
            }
        });

        const plan = await prisma.subscriptionPlan.findFirst();
        if (!plan) throw new Error('No plans found');

        const subscription = await prisma.subscription.create({
            data: {
                memberId: member.id,
                planId: plan.id,
                startDate: new Date(),
                endDate: new Date(),
                paidAmount: 0 // Start with 0 paid
            }
        });

        console.log(`✅ Created Subscription ${subscription.id} for Plan price ${plan.price}`);

        // 2. Mock API Call Logic for Overpayment
        console.log('💸 Attempting overpayment...');

        const overLimitAmount = plan.price + 50;

        // Simulate the check logic from the route
        const planPrice = plan.price;
        const currentPaid = subscription.paidAmount;
        const remaining = planPrice - currentPaid;

        if (overLimitAmount > remaining + 0.01) {
            console.log(`✅ SUCCESS: Overpayment detected! Requested: ${overLimitAmount}, Remaining: ${remaining}`);
        } else {
            console.error(`❌ FAILURE: Overpayment NOT detected. Requested: ${overLimitAmount}, Remaining: ${remaining}`);
        }

        // 3. Mock Correct Payment
        console.log('💰 Attempting valid payment...');
        const validAmount = plan.price / 2;
        if (validAmount <= remaining + 0.01) {
            console.log(`✅ SUCCESS: Valid payment accepted. Requested: ${validAmount}, Remaining: ${remaining}`);
        } else {
            console.error(`❌ FAILURE: Valid payment rejected.`);
        }

        // Cleanup
        await prisma.subscription.delete({ where: { id: subscription.id } });
        await prisma.member.delete({ where: { id: member.id } });
        console.log('🧹 Cleanup complete');

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
