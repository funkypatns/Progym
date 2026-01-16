/**
 * RBAC Verification Logic (Temp)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    console.log('Starting RBAC Verification...');

    try {
        // 1. Verify User Model has permissions field
        console.log('Checking Schema...');
        try {
            // We can't easily check schema definition at runtime via client, 
            // but we can check if we can select the field or if it returns data.
            // If the field didn't exist in Prisma Client, this query would fail type check in TS,
            // but in JS it might just ignore strict selection or throw if we try to select it explicitly.

            const admin = await prisma.user.findFirst({
                where: { role: 'admin' },
                select: { id: true, permissions: true } // Explicit select
            });

            if (admin) {
                // If we got here, the query succeeded, so the client knows about 'permissions'.
                // Now check if it returned undefined (meaning DB column missing or not populated).
                if (admin.permissions !== undefined) {
                    console.log('✅ Schema Correct: User model has permissions field accessible via Prisma.');
                    console.log('   Admin Permissions Value:', admin.permissions);
                } else {
                    console.error('❌ Schema Error: permissions field returned undefined.');
                }
            } else {
                console.log('⚠️ No admin user found to verify schema.');
            }
        } catch (e) {
            console.error('❌ Schema Error: Failed to query permissions field.', e.message);
        }

        // 2. Verify Staff Users have permissions in DB (if any)
        const staff = await prisma.user.findFirst({
            where: { role: 'staff' },
            select: { id: true, permissions: true }
        });

        if (staff) {
            console.log(`Checking Staff User (ID: ${staff.id})...`);
            console.log('   Staff Permissions (DB):', staff.permissions);
        } else {
            console.log('ℹ️ No staff user found.');
        }

        console.log('RBAC Database Check Complete.');

    } catch (error) {
        console.error('Verification Fatal Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
