const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceCloseShift(shiftId) {
    try {
        console.log(`Checking status of Shift ID: ${shiftId}...`);

        const shift = await prisma.pOSShift.findUnique({
            where: { id: shiftId }
        });

        if (!shift) {
            console.error(`Shift ID ${shiftId} not found!`);
            return;
        }

        console.log(`Current Status: ${shift.status}`);

        if (shift.status === 'closed') {
            console.log("Shift is already closed. No action needed.");
            return;
        }

        const updatedShift = await prisma.pOSShift.update({
            where: { id: shiftId },
            data: {
                status: 'closed',
                closedAt: new Date(),
                closingCash: shift.openingCash, // Auto-close with opening cash to balance
                expectedCash: shift.openingCash,
                cashDifference: 0,
                notes: 'Force closed by system administrator due to stuck session'
            }
        });

        console.log(`✅ Successfully closed Shift ID: ${updatedShift.id}`);
        console.log(`Closed At: ${updatedShift.closedAt}`);

    } catch (error) {
        console.error("Error force closing shift:", error);
    } finally {
        await prisma.$disconnect();
    }
}

// Execute for ID 26 as reported by user
forceCloseShift(26);
