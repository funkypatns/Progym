/**
 * ============================================
 * DATABASE SEED FILE
 * ============================================
 * 
 * Creates initial data for the Gym Management System:
 * - Default admin user
 * - Sample subscription plans
 * - Default settings
 * 
 * Run with: npm run seed
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // ============================================
    // CREATE DEFAULT ADMIN USER
    // ============================================

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            email: 'admin@gym.local',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            isActive: true
        }
    });
    console.log('✅ Created admin user:', admin.username);

    // Create a staff user
    const staff = await prisma.user.upsert({
        where: { username: 'staff' },
        update: {},
        create: {
            username: 'staff',
            email: 'staff@gym.local',
            password: await bcrypt.hash('staff123', 10),
            firstName: 'Staff',
            lastName: 'User',
            role: 'staff',
            isActive: true
        }
    });
    console.log('✅ Created staff user:', staff.username);

    // ============================================
    // CREATE SUBSCRIPTION PLANS
    // ============================================

    const plans = [
        {
            name: 'Monthly Basic',
            nameAr: 'الشهري الأساسي',
            duration: 30,
            durationType: 'days',
            price: 100,
            description: 'Basic gym access for one month',
            descriptionAr: 'وصول أساسي للنادي لمدة شهر',
            features: JSON.stringify(['Gym Access', 'Locker Room', 'Basic Equipment']),
            sortOrder: 1
        },
        {
            name: 'Quarterly Standard',
            nameAr: 'ربع سنوي قياسي',
            duration: 90,
            durationType: 'days',
            price: 250,
            description: 'Standard access for three months with 15% discount',
            descriptionAr: 'وصول قياسي لمدة ثلاثة أشهر مع خصم 15%',
            features: JSON.stringify(['Gym Access', 'Locker Room', 'All Equipment', 'Free Towels']),
            sortOrder: 2
        },
        {
            name: 'Semi-Annual Premium',
            nameAr: 'نصف سنوي مميز',
            duration: 180,
            durationType: 'days',
            price: 450,
            description: 'Premium access for six months with 25% discount',
            descriptionAr: 'وصول مميز لمدة ستة أشهر مع خصم 25%',
            features: JSON.stringify(['Full Gym Access', 'Locker Room', 'All Equipment', 'Free Towels', 'Personal Trainer (2 sessions)']),
            sortOrder: 3
        },
        {
            name: 'Annual VIP',
            nameAr: 'السنوي VIP',
            duration: 365,
            durationType: 'days',
            price: 800,
            description: 'VIP access for one year with 35% discount',
            descriptionAr: 'وصول VIP لمدة سنة مع خصم 35%',
            features: JSON.stringify(['Full Gym Access', 'VIP Locker', 'All Equipment', 'Free Towels', 'Personal Trainer (12 sessions)', 'Nutrition Plan', 'Guest Passes (3)']),
            sortOrder: 4
        }
    ];

    for (const plan of plans) {
        await prisma.subscriptionPlan.upsert({
            where: { id: plans.indexOf(plan) + 1 },
            update: plan,
            create: plan
        });
    }
    console.log('✅ Created subscription plans:', plans.length);

    // ============================================
    // CREATE DEFAULT SETTINGS
    // ============================================

    const settings = [
        // General Settings
        { key: 'gym_name', value: 'Gym Management System', type: 'string', group: 'general' },
        { key: 'gym_name_ar', value: 'نظام إدارة النادي الرياضي', type: 'string', group: 'general' },
        { key: 'gym_phone', value: '+1234567890', type: 'string', group: 'general' },
        { key: 'gym_email', value: 'info@gym.local', type: 'string', group: 'general' },
        { key: 'gym_address', value: '123 Fitness Street, City', type: 'string', group: 'general' },
        { key: 'currency', value: 'USD', type: 'string', group: 'general' },
        { key: 'currency_symbol', value: '$', type: 'string', group: 'general' },

        // Branding
        { key: 'primary_color', value: '#3B82F6', type: 'string', group: 'branding' },
        { key: 'secondary_color', value: '#10B981', type: 'string', group: 'branding' },
        { key: 'logo_path', value: '', type: 'string', group: 'branding' },

        // System
        { key: 'language', value: 'en', type: 'string', group: 'system' },
        { key: 'theme', value: 'dark', type: 'string', group: 'system' },
        { key: 'date_format', value: 'DD/MM/YYYY', type: 'string', group: 'system' },
        { key: 'time_format', value: '24h', type: 'string', group: 'system' },

        // Check-in
        { key: 'checkin_qr_enabled', value: 'true', type: 'boolean', group: 'checkin' },
        { key: 'checkin_face_enabled', value: 'true', type: 'boolean', group: 'checkin' },
        { key: 'checkin_block_expired', value: 'true', type: 'boolean', group: 'checkin' },

        // Notifications
        { key: 'notify_expiry_days', value: '7', type: 'number', group: 'notifications' },
        { key: 'notify_birthday', value: 'true', type: 'boolean', group: 'notifications' }
    ];

    for (const setting of settings) {
        await prisma.setting.upsert({
            where: { key: setting.key },
            update: setting,
            create: setting
        });
    }
    console.log('✅ Created default settings:', settings.length);

    // ============================================
    // CREATE SAMPLE MEMBERS (for demo)
    // ============================================

    const sampleMembers = [
        {
            memberId: 'GYM-001',
            firstName: 'Ahmed',
            lastName: 'Hassan',
            email: 'ahmed@example.com',
            phone: '+1234567001',
            gender: 'male',
            isActive: true
        },
        {
            memberId: 'GYM-002',
            firstName: 'Sarah',
            lastName: 'Johnson',
            email: 'sarah@example.com',
            phone: '+1234567002',
            gender: 'female',
            isActive: true
        },
        {
            memberId: 'GYM-003',
            firstName: 'Mohammed',
            lastName: 'Ali',
            email: 'mohammed@example.com',
            phone: '+1234567003',
            gender: 'male',
            isActive: true
        }
    ];

    for (const member of sampleMembers) {
        const createdMember = await prisma.member.upsert({
            where: { memberId: member.memberId },
            update: member,
            create: member
        });

        // Create a sample subscription for each member
        await prisma.subscription.create({
            data: {
                memberId: createdMember.id,
                planId: 1, // Monthly Basic
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                status: 'active',
                paidAmount: 100
            }
        });
    }
    console.log('✅ Created sample members:', sampleMembers.length);

    // ============================================
    // CREATE DEFAULT POS MACHINE
    // ============================================

    const defaultMachine = await prisma.pOSMachine.upsert({
        where: { machineKey: 'default-counter-pos' },
        update: {},
        create: {
            machineKey: 'default-counter-pos',
            name: 'Counter POS',
            status: 'active'
        }
    });
    console.log('✅ Created default POS machine:', defaultMachine.name);

    console.log('');
    console.log('🎉 Database seeded successfully!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Staff: staff / staff123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
