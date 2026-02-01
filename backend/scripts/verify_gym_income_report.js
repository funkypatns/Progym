
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CommissionService = require('../services/commissionService');

async function verifyGymIncome() {
    console.log('🚀 Starting Gym Income Report Verification...');

    // 1. Setup Data
    const email = `report_test_${Date.now()}@test.com`;
    const member = await prisma.member.create({
        data: {
            firstName: 'Report',
            lastName: 'Tester',
            email,
            phone: '01000000000',
            gender: 'male',
            memberId: `M-${Date.now()}` // Unique ID
        }
    });
    const coach = await prisma.user.create({
        data: { firstName: 'Coach', lastName: 'Money', email: `coach_${Date.now()}@test.com`, role: 'coach', username: `coach_${Date.now()}`, password: 'password' }
    });

    // Commission Rule: 50%
    await prisma.coachCommissionSettings.upsert({
        where: { coachId: coach.id },
        create: { coachId: coach.id, value: 50, type: 'percentage' },
        update: { value: 50, type: 'percentage' }
    });

    // 2. Create Appointment
    const appointment = await prisma.appointment.create({
        data: {
            title: 'PT Session',
            coachId: coach.id,
            memberId: member.id,
            start: new Date(),
            end: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour
            status: 'scheduled'
        }
    });
    console.log('✅ Appointment Created:', appointment.id);

    // 3. Complete Appointment (Triggers Financial Record Creation)
    // We simulate the service call
    await CommissionService.processSessionCommission(appointment.id, prisma);

    // Update appointment status manually to match what API does
    await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'completed' } // Enums usually lowercase in this DB based on history
    });
    console.log('✅ Appointment Completed & Commission Processed');

    // 4. Verify Financial Record Exists
    const record = await prisma.appointmentFinancialRecord.findUnique({
        where: { appointmentId: appointment.id }
    });

    if (!record) throw new Error('❌ Financial Record NOT created!');
    console.log('✅ Financial Record Found:', record.id);

    // 5. Verify Report Query Logic (The Fix)
    // Simulate the route logic: from = today, to = today
    const from = new Date().toISOString().split('T')[0];
    const to = from;

    const startDate = new Date(from);
    const endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999); // The Fix

    console.log(`🔎 Testing Query: ${startDate.toISOString()} -> ${endDate.toISOString()}`);

    const reportRecords = await prisma.appointmentFinancialRecord.findMany({
        where: {
            completedAt: {
                gte: startDate,
                lte: endDate
            },
            coachId: coach.id
        }
    });

    if (reportRecords.length === 0) {
        throw new Error('❌ Report Query failed to find the record (Date Logic Bug?)');
    }

    const match = reportRecords.find(r => r.appointmentId === appointment.id);
    if (!match) throw new Error('❌ Report found records but not OUR record');

    console.log('✅ Report Query Success! Record found in date range.');
    console.log(`   Session Price: ${match.sessionPrice}`);
    console.log(`   Coach Comm: ${match.coachCommission}`);
    console.log(`   Net Income: ${match.gymNetIncome}`);

    // Cleanup
    await prisma.appointmentFinancialRecord.delete({ where: { id: record.id } });
    await prisma.appointment.delete({ where: { id: appointment.id } });
    await prisma.member.delete({ where: { id: member.id } });
    await prisma.user.delete({ where: { id: coach.id } });

    console.log('✨ Cleanup Done. Verification Passed.');
}

verifyGymIncome()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
