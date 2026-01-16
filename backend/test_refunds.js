const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRefunds() {
    console.log('--- Starting Refund Logic Test ---');
    try {
        // 1. Find a member
        const member = await prisma.member.findFirst();
        if (!member) throw new Error('No member found for test');

        // 2. Create a test payment
        const payment = await prisma.payment.create({
            data: {
                memberId: member.id,
                amount: 1000,
                method: 'cash',
                receiptNumber: `TEST-${Date.now()}`,
                status: 'completed',
                paidAt: new Date()
            }
        });
        console.log(`Created payment: ID=${payment.id}, Amount=${payment.amount}`);

        // 2a. Find or Create an open shift for the user
        let shift = await prisma.pOSShift.findFirst({
            where: { closedAt: null }
        });

        if (!shift) {
            // Create a dummy shift if none exists
            shift = await prisma.pOSShift.create({
                data: {
                    openedBy: 1, // Assuming admin ID 1
                    machineId: 1, // Assuming machine ID 1
                    openingBalance: 0
                }
            });
            console.log(`Created test shift: ${shift.id}`);
        } else {
            console.log(`Using existing shift: ${shift.id}`);
        }

        // 3. First Partial Refund (300)
        console.log('Performing first partial refund (300)...');
        // Simulate Logic from payments.js
        const refund1 = await prisma.refund.create({
            data: {
                paymentId: payment.id,
                amount: 300,
                reason: 'Partial 1',
                createdBy: 1, // Assuming admin ID 1 exists
                shiftId: shift.id // Required field!
            }
        });

        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'Partial Refund',
                refundedTotal: 300
            }
        });

        const p1 = await prisma.payment.findUnique({ where: { id: payment.id } });
        console.log(`P1 Status: ${p1.status}, RefundedTotal: ${p1.refundedTotal}`);

        // 4. Second Partial Refund (400) - Total = 700
        console.log('Performing second partial refund (400)...');
        await prisma.refund.create({
            data: {
                paymentId: payment.id,
                amount: 400,
                reason: 'Partial 2',
                createdBy: 1,
                shiftId: shift.id
            }
        });

        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'Partial Refund',
                refundedTotal: 700
            }
        });

        const p2 = await prisma.payment.findUnique({ where: { id: payment.id } });
        console.log(`P2 Status: ${p2.status}, RefundedTotal: ${p2.refundedTotal}`);

        // 5. Final Refund (300) - Total = 1000
        console.log('Performing final refund (300)...');
        await prisma.refund.create({
            data: {
                paymentId: payment.id,
                amount: 300,
                reason: 'Full',
                createdBy: 1,
                shiftId: shift.id
            }
        });

        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'refunded',
                refundedTotal: 1000
            }
        });

        const p3 = await prisma.payment.findUnique({ where: { id: payment.id } });
        console.log(`P3 Status: ${p3.status}, RefundedTotal: ${p3.refundedTotal}`);

        // Cleanup
        await prisma.refund.deleteMany({ where: { paymentId: payment.id } });
        await prisma.payment.delete({ where: { id: payment.id } });
        console.log('Cleanup complete.');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testRefunds();
