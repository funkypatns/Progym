/**
 * Backfill Missing Coach Earnings
 * 
 * This script finds completed/auto_completed appointments that don't have
 * corresponding CoachEarning records and creates them.
 * 
 * Usage: node scripts/backfill_coach_earnings.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const CommissionService = require('../services/commissionService');

async function backfillEarnings() {
    console.log('Starting coach earnings backfill...\n');

    try {
        // Find all completed/auto_completed sessions
        const completedSessions = await prisma.appointment.findMany({
            where: {
                status: {
                    in: ['completed', 'auto_completed']
                },
                coachId: {
                    not: null
                }
            },
            include: {
                coach: true
            },
            orderBy: {
                start: 'desc'
            }
        });

        console.log(`Found ${completedSessions.length} completed sessions with coaches\n`);

        let created = 0;
        let skipped = 0;
        let errors = 0;

        for (const session of completedSessions) {
            try {
                // Check if earning already exists
                const existing = await prisma.coachEarning.findFirst({
                    where: { appointmentId: session.id }
                });

                if (existing) {
                    skipped++;
                    continue;
                }

                // Create earning using CommissionService (idempotent)
                await CommissionService.processSessionCommission(session.id);

                console.log(`✓ Created earning for session #${session.id} - ${session.coach.firstName} ${session.coach.lastName} - ${session.start}`);
                created++;

            } catch (error) {
                console.error(`✗ Failed for session #${session.id}: ${error.message}`);
                errors++;
            }
        }

        console.log('\n=== Backfill Summary ===');
        console.log(`Total sessions processed: ${completedSessions.length}`);
        console.log(`Earnings created: ${created}`);
        console.log(`Already existed (skipped): ${skipped}`);
        console.log(`Errors: ${errors}`);

    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    backfillEarnings();
}

module.exports = backfillEarnings;
