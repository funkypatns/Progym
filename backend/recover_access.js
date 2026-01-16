
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function recover() {
    console.log('🔄 Starting System Recovery...');

    // 1. Reset Admin Password
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Upsert admin user
        const admin = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {
                password: hashedPassword,
                isActive: true,
                role: 'admin'
            },
            create: {
                username: 'admin',
                password: hashedPassword,
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@gym.com',
                role: 'admin',
                isActive: true
            }
        });
        console.log('✅ Admin user restored/reset.');
        console.log('   Username: admin');
        console.log('   Password: admin123');

    } catch (error) {
        console.error('❌ Failed to reset admin:', error);
    }

    // 2. Clear License Cache
    try {
        const cachePath = path.join(__dirname, 'data/license_cache.enc');
        if (fs.existsSync(cachePath)) {
            fs.unlinkSync(cachePath);
            console.log('✅ Corrupted license cache cleared.');
        } else {
            console.log('ℹ️  No license cache found (clean state).');
        }
    } catch (error) {
        console.error('❌ Failed to clear license cache:', error);
    }

    console.log('\nRecovery Complete.');
}

recover()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
