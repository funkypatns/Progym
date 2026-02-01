const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAppointmentPrices() {
    try {
        console.log('Checking appointments for today...');

        // Find appointments for the user in the logs (sara mohamed) and date (Jan 28 2026)
        // Adjust date query as needed
        const appointments = await prisma.appointment.findMany({
            orderBy: { id: 'desc' },
            take: 10,
            include: {
                member: true,
                coach: true
            }
        });

        console.log(`Found ${appointments.length} appointments.`);

        for (const app of appointments) {
            console.log(`ID: ${app.id}, Title: ${app.title}, Price: ${app.price}, Member: ${app.member?.firstName}, Coach: ${app.coach?.firstName}`);

            // Check Financial Record
            const fin = await prisma.appointmentFinancialRecord.findUnique({
                where: { appointmentId: app.id }
            });
            console.log(`   -> Financial Record: SessionPrice: ${fin?.sessionPrice}, Net: ${fin?.gymNetIncome}`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkAppointmentPrices();
