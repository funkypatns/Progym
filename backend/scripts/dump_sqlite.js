// Output file: gym_data_dump.json
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function dumpData() {
    console.log('📦 Starting SQLite to JSON dump...');
    const data = {};

    try {
        console.log('Reading Users...');
        data.users = await prisma.user.findMany();

        console.log('Reading Members...');
        data.members = await prisma.member.findMany();

        console.log('Reading Plans...');
        data.plans = await prisma.subscriptionPlan.findMany();

        console.log('Reading POS Machines...');
        data.posMachines = await prisma.pOSMachine.findMany();

        console.log('Reading Settings...');
        data.settings = await prisma.setting.findMany();

        console.log('Reading Subscriptions...');
        data.subscriptions = await prisma.subscription.findMany();

        console.log('Reading Shifts...');
        data.shifts = await prisma.pOSShift.findMany();

        console.log('Reading Payments...');
        data.payments = await prisma.payment.findMany();

        console.log('Reading Refunds...');
        data.refunds = await prisma.refund.findMany();

        console.log('Reading Cash Closings...');
        data.cashClosings = await prisma.cashClosing.findMany();

        console.log('Reading CheckIns...');
        data.checkIns = await prisma.checkIn.findMany();

        console.log('Reading Expenses...');
        data.expenses = await prisma.expense.findMany();

        console.log('Reading Reminders...');
        data.reminders = await prisma.reminder.findMany();

        console.log('Reading Staff Notifications...');
        data.staffNotifications = await prisma.staffNotification.findMany();

        // Optional: Activity/Audit Logs (might be large)
        console.log('Reading Activity Logs...');
        data.activityLogs = await prisma.activityLog.findMany();

        console.log('Reading Audit Logs...');
        data.auditLogs = await prisma.auditLog.findMany();

        const timestamp = new Date().toISOString();
        const dump = { timestamp, data };

        const outputPath = path.join(__dirname, '..', 'gym_data_dump.json');
        fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));

        console.log(`✅ Data dump completed successfully!`);
        console.log(`📂 File saved at: ${outputPath}`);

    } catch (error) {
        console.error('❌ Dump failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

dumpData();
