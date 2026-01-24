const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const main = async () => {
    const orphanPayments = await prisma.payment.findMany({
        where: {
            subscriptionId: null,
            status: { in: ['completed', 'COMPLETED', 'paid', 'PAID'] }
        },
        select: {
            id: true,
            memberId: true,
            amount: true,
            status: true,
            receiptNumber: true,
            notes: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    });

    if (orphanPayments.length === 0) {
        console.log('No orphan payments found (completed without subscriptionId).');
        return;
    }

    console.log(`Found ${orphanPayments.length} payments without subscriptionId (showing latest 50):`);
    orphanPayments.forEach(p => {
        console.log(`- #${p.id} member=${p.memberId} amount=${p.amount} status=${p.status} receipt=${p.receiptNumber} createdAt=${p.createdAt.toISOString()}`);
    });

    const partialOrphans = orphanPayments.filter(p => /partial/i.test(p.notes || ''));
    if (partialOrphans.length > 0) {
        console.log(`\nPossible partial payments without subscriptionId (notes include "partial"):`);
        partialOrphans.forEach(p => {
            console.log(`- #${p.id} member=${p.memberId} amount=${p.amount} receipt=${p.receiptNumber}`);
        });
    }
};

main()
    .catch((err) => {
        console.error('Failed to check orphan payments:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
