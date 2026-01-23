const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testResetFlow() {
    console.log("🚀 Starting Reset Flow Verification...");

    try {
        // Cleanup existing test data if any
        await prisma.cashMovement.deleteMany({ where: { reason: 'Test Movement' } });
        await prisma.member.deleteMany({ where: { memberId: 'TEST-001' } });
        await prisma.pOSShift.deleteMany({ where: { status: 'open', openingCash: 100 } });

        // 1. Create a dummy member
        const member = await prisma.member.create({
            data: {
                memberId: 'TEST-001',
                firstName: 'Test',
                lastName: 'User',
                phone: '123456789'
            }
        });
        console.log("✅ Created dummy member");

        // 2. Create a dummy machine
        const machine = await prisma.pOSMachine.upsert({
            where: { machineKey: 'TEST-MACHINE' },
            update: {},
            create: {
                name: 'Test Machine',
                machineKey: 'TEST-MACHINE',
                status: 'active'
            }
        });

        // 3. Create a shift
        const user = await prisma.user.findFirst({ where: { role: 'admin' } });
        if (!user) throw new Error("No admin user found to open shift");

        const shift = await prisma.pOSShift.create({
            data: {
                machineId: machine.id,
                openedBy: user.id,
                openingCash: 100,
                status: 'open'
            }
        });
        console.log("✅ Created dummy shift");

        // 4. Create a cash movement (The one that was likely causing the crash)
        await prisma.cashMovement.create({
            data: {
                type: 'IN',
                amount: 50,
                reason: 'Test Movement',
                shiftId: shift.id,
                employeeId: user.id
            }
        });
        console.log("✅ Created dummy cash movement");

        // 5. Test the reset logic by triggering it via a script-controlled simulation
        // (Instead of calling API over HTTP, we simulate the transaction logic)
        console.log("🧪 Simulating 'all' reset transaction...");

        // This is a simplified version of the logic in settings.js
        await prisma.$transaction(async (tx) => {
            // Level 1: Deepest children
            await tx.saleItem.deleteMany({});
            await tx.saleTransaction.deleteMany({});
            await tx.stockMovement.deleteMany({});
            await tx.refund.deleteMany({});
            await tx.cashMovement.deleteMany({});

            // Level 2: Middle children
            await tx.payment.deleteMany({});
            await tx.checkIn.deleteMany({});
            await tx.subscription.deleteMany({});
            await tx.reminder.deleteMany({});
            await tx.cashClosingAdjustment.deleteMany({});
            await tx.cashClosing.deleteMany({});

            // Level 3: Parents
            await tx.member.deleteMany({});
            await tx.pOSShift.deleteMany({});
        });

        console.log("🎉 Reset Simulation Successful! No foreign key errors.");

    } catch (error) {
        console.error("❌ Reset Logic Failed:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testResetFlow();
