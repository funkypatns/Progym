/**
 * Verification script for Data Management reset logic.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('🚀 Starting Data Management Verification...');

    try {
        // 1. Setup Dummy Data
        console.log('📝 Creating dummy data...');

        // Ensure a user exists for relations
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log('❌ No user found in database. Please run seed first.');
            process.exit(1);
        }

        // Create a member
        const member = await prisma.member.create({
            data: {
                memberId: `TEST-${Date.now()}`,
                firstName: 'Test',
                lastName: 'User',
                phone: '123456789'
            }
        });

        // Create a plan
        const plan = await prisma.subscriptionPlan.create({
            data: {
                name: 'Test Plan',
                duration: 30,
                price: 100
            }
        });

        // Create a subscription
        const sub = await prisma.subscription.create({
            data: {
                memberId: member.id,
                planId: plan.id,
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });

        // Create a payment linked to member and sub
        await prisma.payment.create({
            data: {
                memberId: member.id,
                subscriptionId: sub.id,
                amount: 100,
                method: 'cash',
                receiptNumber: `RCPT-${Date.now()}`,
                createdBy: user.id
            }
        });

        console.log('✅ Dummy data created successfully.');

        // 2. Mock the Reset Payload
        console.log('🧹 Simulating Reset Everything...');

        // We'll call the actual prisma operations as they are in the route
        // to verify no FK errors occur in the transaction

        await prisma.$transaction(async (tx) => {
            // This mirrors the logic in backend/routes/settings.js

            // 2. Payments
            await tx.payment.deleteMany({});

            // 3. Check-ins
            await tx.checkIn.deleteMany({});

            // 4. Subscriptions
            await tx.subscription.deleteMany({});

            // 5. Members
            await tx.member.deleteMany({});

            // 6. Plans
            await tx.subscriptionPlan.deleteMany({});
        });

        console.log('✅ Reset transaction completed without errors!');

        // 3. Final Verification
        const mCount = await prisma.member.count();
        const pCount = await prisma.payment.count();

        if (mCount === 0 && pCount === 0) {
            console.log('✨ SUCCESS: All test data cleared successfully.');
        } else {
            console.log(`⚠️ WARNING: Data remains. Members: ${mCount}, Payments: ${pCount}`);
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
