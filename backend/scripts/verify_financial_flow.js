const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CommissionService = require('../services/commissionService');

async function verifyFlow() {
    console.log('--- STARTING FINANCIAL FLOW VERIFICATION ---');

    // 1. Setup Data
    console.log('\n1. Creating Test Data...');
    const coach = await prisma.user.findFirst({ where: { role: 'staff' } });
    const member = await prisma.member.findFirst();

    if (!coach || !member) {
        throw new Error('Need at least 1 coach and 1 member in DB');
    }

    // Ensure Commission Settings
    const settings = await prisma.coachCommissionSettings.upsert({
        where: { coachId: coach.id },
        update: { type: 'percentage', value: 50, internalSessionValue: 0 },
        create: { coachId: coach.id, type: 'percentage', value: 50, internalSessionValue: 0 }
    });
    console.log(`   Coach ${coach.firstName} has 50% commission rule.`);

    // Create Appointment
    const appointment = await prisma.appointment.create({
        data: {
            title: 'TEST FINANCIAL FLOW',
            start: new Date(),
            end: new Date(new Date().getTime() + 3600000),
            coachId: coach.id,
            memberId: member.id,
            price: 100,
            status: 'scheduled'
        }
    });
    console.log(`   Created Appointment #${appointment.id} with Price $100`);

    // 2. Test Preview
    console.log('\n2. Testing Preview Endpoint Logic...');
    const preview = await CommissionService.calculateCommissionPreview(appointment.id, prisma);
    console.log('   Preview Result:', JSON.stringify(preview, null, 2));

    if (preview.sessionPrice !== 100) throw new Error('Preview Price Mismatch');
    if (preview.commissionAmount !== 50) throw new Error('Preview Commission Calculation Failed (Expected 50)');
    if (preview.gymNetIncome !== 50) throw new Error('Preview Net Income Failed (Expected 50)');

    // 3. Test Completion
    console.log('\n3. Testing Completion (Commit)...');
    await CommissionService.processSessionCommission(appointment.id, prisma);

    // Verify Record
    const record = await prisma.appointmentFinancialRecord.findUnique({
        where: { appointmentId: appointment.id }
    });

    if (!record) throw new Error('Financial Record NOT created!');
    console.log('   Financial Record Created:', JSON.stringify(record, null, 2));

    if (record.gymNetIncome !== 50) throw new Error('Saved Net Income Invalid');

    // 4. Test Report Query (Simulate Logic)
    console.log('\n4. Testing Report Data Availability...');
    const records = await prisma.appointmentFinancialRecord.findMany({
        where: { appointmentId: appointment.id }
    });

    const totalNet = records.reduce((sum, r) => sum + r.gymNetIncome, 0);
    console.log(`   Report Query found ${records.length} records. Total Net: ${totalNet}`);

    if (totalNet !== 50) throw new Error('Report Aggregation Failed');

    // Cleanup
    console.log('\n5. Cleaning up...');
    await prisma.appointmentFinancialRecord.delete({ where: { appointmentId: appointment.id } });
    await prisma.appointment.delete({ where: { id: appointment.id } });

    console.log('\n--- VERIFICATION SUCCESSFUL: 100% COMPLIANCE ---');
}

verifyFlow()
    .catch(e => {
        console.error('\n!!! VERIFICATION FAILED !!!');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
