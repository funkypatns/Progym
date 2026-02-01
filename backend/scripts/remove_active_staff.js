const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting staff removal process...');
    try {
        // Count non-admin users first
        const count = await prisma.user.count({
            where: {
                role: { not: 'admin' }
            }
        });

        if (count === 0) {
            console.log('No staff users found to delete.');
            return;
        }

        console.log(`Found ${count} staff users. Attempting to delete...`);

        // Attempt deletion
        const result = await prisma.user.deleteMany({
            where: {
                role: { not: 'admin' }
            }
        });

        console.log(`SUCCESS: Deleted ${result.count} employees.`);
    } catch (e) {
        console.error("ERROR: Failed to delete employees.");
        console.error(e.message);

        if (e.code === 'P2003' || e.message.includes('Foreign key constraint')) {
            console.log("---------------------------------------------------");
            console.log("REASON: These users have linked data (Shifts, Payments, Appointments).");
            console.log("SOLUTION: Please go to Settings > Clear Data and perform a 'Factory Reset' (or clear all modules) first.");
            console.log("---------------------------------------------------");
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
