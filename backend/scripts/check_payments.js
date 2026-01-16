const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrphanPayments() {
    try {
        const totalPayments = await prisma.payment.count();
        const orphanPayments = await prisma.payment.count({
            where: { createdBy: null }
        });

        console.log(`Total Payments: ${totalPayments}`);
        console.log(`Orphan Payments (missing createdBy): ${orphanPayments}`);

        if (orphanPayments > 0) {
            const sampleOrphans = await prisma.payment.findMany({
                where: { createdBy: null },
                take: 5,
                include: {
                    member: { select: { firstName: true, lastName: true } }
                }
            });
            console.log('Sample orphans:', JSON.stringify(sampleOrphans, null, 2));
        }
    } catch (error) {
        console.error('Error checking payments:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkOrphanPayments();
