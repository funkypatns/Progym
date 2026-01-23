const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOpenShifts() {
    try {
        const shifts = await prisma.pOSShift.findMany({
            where: { status: 'open' }
        });
        console.log('OPEN_SHIFTS_START');
        console.log(JSON.stringify(shifts, null, 2));
        console.log('OPEN_SHIFTS_END');
    } catch (error) {
        console.error("Error checking shifts:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkOpenShifts();
