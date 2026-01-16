const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
    try {
        console.log('Starting payment backfill...');

        // Find activity logs for CREATE_PAYMENT
        const logs = await prisma.activityLog.findMany({
            where: { action: 'CREATE_PAYMENT', entityType: 'Payment' }
        });

        console.log(`Found ${logs.length} relevant activity logs.`);

        let updatedCount = 0;
        for (const log of logs) {
            if (!log.entityId) continue;

            // Update the payment if createdBy is null
            const updated = await prisma.payment.updateMany({
                where: {
                    id: log.entityId,
                    createdBy: null
                },
                data: {
                    createdBy: log.userId
                }
            });
            updatedCount += updated.count;
        }

        console.log(`Backfill complete. Updated ${updatedCount} payments.`);

        // Final check
        const remainingOrphans = await prisma.payment.count({
            where: { createdBy: null }
        });
        console.log(`Remaining orphan payments: ${remainingOrphans}`);

    } catch (error) {
        console.error('Backfill error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

backfill();
