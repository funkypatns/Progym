/**
 * ============================================
 * SEED SCRIPT
 * ============================================
 * 
 * Creates sample licenses for testing.
 * Run with: npm run seed
 */

require('dotenv').config();
const { initDatabase, LicenseModel } = require('./database');

async function seed() {
    console.log('🌱 Seeding license database...\n');

    initDatabase();

    // Create sample licenses
    const licenses = [
        {
            type: 'trial',
            ownerName: 'Demo User',
            ownerEmail: 'demo@example.com',
            gymName: 'Demo Gym',
            maxMembers: 50,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        },
        {
            type: 'standard',
            ownerName: 'Test Gym Owner',
            ownerEmail: 'test@gym.com',
            gymName: 'Fitness Center',
            maxMembers: 100,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
        },
        {
            type: 'premium',
            ownerName: 'Premium Client',
            ownerEmail: 'premium@gym.com',
            gymName: 'Premium Fitness',
            maxMembers: 500,
            expiresAt: null // Never expires
        }
    ];

    console.log('Creating licenses:\n');

    for (const licData of licenses) {
        const result = LicenseModel.create(licData);
        console.log(`✅ ${licData.type.toUpperCase()}: ${result.key}`);
        console.log(`   Owner: ${licData.ownerName}`);
        console.log(`   Gym: ${licData.gymName}`);
        console.log(`   Max Members: ${licData.maxMembers}`);
        console.log(`   Expires: ${licData.expiresAt || 'Never'}`);
        console.log('');
    }

    console.log('🎉 Seeding complete!\n');
    console.log('Admin Login:');
    console.log(`   Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
}

seed().catch(console.error);
