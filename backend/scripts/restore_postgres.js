// Input file: gym_data_dump.json
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function restoreData() {
    console.log('📦 Starting JSON to PostgreSQL restore...');

    const dumpPath = path.join(__dirname, '..', 'gym_data_dump.json');
    if (!fs.existsSync(dumpPath)) {
        console.error('❌ Dump file not found:', dumpPath);
        process.exit(1);
    }

    const { data } = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));

    try {
        // 1. Users
        console.log(`Importing ${data.users.length} Users...`);
        if (data.users.length > 0) {
            await prisma.user.createMany({ data: data.users, skipDuplicates: true });
            // Reset sequence? Postgres usually handles it if we insert IDs, but safe to setval later if needed.
        }

        // 2. Settings
        console.log(`Importing ${data.settings.length} Settings...`);
        if (data.settings.length > 0) {
            await prisma.setting.createMany({ data: data.settings, skipDuplicates: true });
        }

        // 3. POS Machines
        console.log(`Importing ${data.posMachines.length} POS Machines...`);
        if (data.posMachines.length > 0) {
            await prisma.pOSMachine.createMany({ data: data.posMachines, skipDuplicates: true });
        }

        // 4. Plans
        console.log(`Importing ${data.plans.length} Plans...`);
        if (data.plans.length > 0) {
            await prisma.subscriptionPlan.createMany({ data: data.plans, skipDuplicates: true });
        }

        // 5. Members
        console.log(`Importing ${data.members.length} Members...`);
        if (data.members.length > 0) {
            await prisma.member.createMany({ data: data.members, skipDuplicates: true });
        }

        // 6. Subscriptions (Depends on Member, Plan)
        console.log(`Importing ${data.subscriptions.length} Subscriptions...`);
        if (data.subscriptions.length > 0) {
            await prisma.subscription.createMany({ data: data.subscriptions, skipDuplicates: true });
        }

        // 7. Shifts (Depends on User, Machine)
        console.log(`Importing ${data.shifts.length} Shifts...`);
        if (data.shifts.length > 0) {
            // Handle nullable fields carefully if needed, createMany handles it well
            await prisma.pOSShift.createMany({ data: data.shifts, skipDuplicates: true });
        }

        // 8. Payments (Depends on Member, Subscription, User, Shift)
        console.log(`Importing ${data.payments.length} Payments...`);
        if (data.payments.length > 0) {
            await prisma.payment.createMany({ data: data.payments, skipDuplicates: true });
        }

        // 9. Refunds (Depends on Payment, Shift, User)
        console.log(`Importing ${data.refunds.length} Refunds...`);
        if (data.refunds.length > 0) {
            await prisma.refund.createMany({ data: data.refunds, skipDuplicates: true });
        }

        // 10. Cash Closings (Depends on User)
        console.log(`Importing ${data.cashClosings.length} Cash Closings...`);
        if (data.cashClosings.length > 0) {
            await prisma.cashClosing.createMany({ data: data.cashClosings, skipDuplicates: true });
        }

        // 11. Expenses
        console.log(`Importing ${data.expenses.length} Expenses...`);
        if (data.expenses.length > 0) {
            await prisma.expense.createMany({ data: data.expenses, skipDuplicates: true });
        }

        // 12. CheckIns
        console.log(`Importing ${data.checkIns.length} CheckIns...`);
        if (data.checkIns.length > 0) {
            await prisma.checkIn.createMany({ data: data.checkIns, skipDuplicates: true });
        }

        // 13. Reminders
        console.log(`Importing ${data.reminders.length} Reminders...`);
        if (data.reminders.length > 0) {
            await prisma.reminder.createMany({ data: data.reminders, skipDuplicates: true });
        }

        // 14. Staff Notifications
        console.log(`Importing ${data.staffNotifications.length} Staff Notifications...`);
        if (data.staffNotifications.length > 0) {
            await prisma.staffNotification.createMany({ data: data.staffNotifications, skipDuplicates: true });
        }

        // 15. Activity/Audit Logs
        console.log(`Importing ${data.auditLogs.length} Audit Logs...`);
        if (data.auditLogs.length > 0) {
            await prisma.auditLog.createMany({ data: data.auditLogs, skipDuplicates: true });
        }

        console.log(`Importing ${data.activityLogs.length} Activity Logs...`);
        if (data.activityLogs.length > 0) {
            await prisma.activityLog.createMany({ data: data.activityLogs, skipDuplicates: true });
        }

        // Reset Sequences (For Postgres Autoincrement)
        console.log('🔄 Resetting sequences...');
        const tables = [
            'User', 'Member', 'SubscriptionPlan', 'Subscription', 'POSMachine', 'POSShift',
            'Payment', 'Refund', 'CashClosing', 'Expense', 'CheckIn', 'Reminder',
            'StaffNotification', 'ActivityLog', 'AuditLog', 'Setting'
        ];

        for (const table of tables) {
            // Prisma defines quoted table names usually "User" or based on map
            // We assume standard public."Table"
            try {
                // This raw query is Postgres specific
                await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id)+1, 1), false) FROM "${table}";`);
            } catch (e) {
                console.warn(`Could not reset sequence for ${table} (might not be autoincrement ID):`, e.message);
            }
        }

        console.log('✅ Restoration completed successfully!');

    } catch (error) {
        console.error('❌ Restore failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

restoreData();
