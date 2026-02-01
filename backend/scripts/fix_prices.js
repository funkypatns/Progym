const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CommissionService = require('../services/commissionService');

async function fixZeroPrices() {
    try {
        console.log('Fixing zero prices for sara records...');

        // IDs found in previous step: 20, 22
        const idsToFix = [20, 22];
        const NEW_PRICE = 200; // Assuming 200 EGP for test

        for (const id of idsToFix) {
            console.log(`Updating Appointment ${id} to price ${NEW_PRICE}...`);
            await prisma.appointment.update({
                where: { id },
                data: { price: NEW_PRICE }
            });

            console.log(`Recalculating commission for ${id}...`);
            await CommissionService.processSessionCommission(id, prisma);
        }

        console.log('Done!');

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

fixZeroPrices();
