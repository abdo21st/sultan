import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '../lib/permissions';
import { prisma } from '../lib/prisma';

async function main() {
    console.log('🌱 Starting database seed...');

    // 1. Create Roles
    console.log('📋 Creating roles...');

    const adminRole = await prisma.customRole.upsert({
        where: { name: 'SUPER_ADMIN' },
        update: {},
        create: {
            name: 'SUPER_ADMIN',
            displayName: 'مدير النظام',
            permissions: Object.values(PERMISSIONS), // All permissions
        },
    });

    const accountantRole = await prisma.customRole.upsert({
        where: { name: 'ACCOUNTANT' },
        update: {},
        create: {
            name: 'ACCOUNTANT',
            displayName: 'محاسب',
            permissions: [
                PERMISSIONS.ORDERS_VIEW,
                PERMISSIONS.ORDERS_VIEW_FINANCIALS,
                PERMISSIONS.TRANSACTIONS_VIEW,
                PERMISSIONS.TRANSACTIONS_ADD,
            ],
        },
    });

    const receptionistRole = await prisma.customRole.upsert({
        where: { name: 'RECEPTIONIST' },
        update: {},
        create: {
            name: 'RECEPTIONIST',
            displayName: 'موظف استقبال',
            permissions: [
                PERMISSIONS.ORDERS_VIEW,
                PERMISSIONS.ORDERS_ADD,
            ],
        },
    });

    const managerRole = await prisma.customRole.upsert({
        where: { name: 'MANAGER' },
        update: {},
        create: {
            name: 'MANAGER',
            displayName: 'مدير',
            permissions: [
                PERMISSIONS.ORDERS_VIEW,
                PERMISSIONS.ORDERS_ADD,
                PERMISSIONS.ORDERS_EDIT,
                PERMISSIONS.ORDERS_CHANGE_STATUS,
                PERMISSIONS.ORDERS_VIEW_FINANCIALS,
                PERMISSIONS.USERS_VIEW,
                PERMISSIONS.FACILITIES_VIEW,
                PERMISSIONS.FACILITIES_ADD,
                PERMISSIONS.FACILITIES_EDIT,
            ],
        },
    });

    console.log('✅ Roles created successfully');

    // 2. Create Users
    console.log('👥 Creating users...');

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            displayName: 'المدير العام',
            phoneNumber: '0912345678',
            password: hashedPassword,
            role: 'ADMIN', // Legacy field
            permissions: Object.values(PERMISSIONS), // Direct permissions
            roles: {
                connect: { id: adminRole.id },
            },
        },
    });

    const accountantUser = await prisma.user.upsert({
        where: { username: 'accountant' },
        update: {},
        create: {
            username: 'accountant',
            displayName: 'أحمد المحاسب',
            phoneNumber: '0912345679',
            password: await bcrypt.hash('acc123', 10),
            role: 'ACCOUNTANT',
            permissions: [],
            roles: {
                connect: { id: accountantRole.id },
            },
        },
    });

    const receptionistUser = await prisma.user.upsert({
        where: { username: 'receptionist' },
        update: {},
        create: {
            username: 'receptionist',
            displayName: 'فاطمة موظفة الاستقبال',
            phoneNumber: '0912345680',
            password: await bcrypt.hash('rec123', 10),
            role: 'USER',
            permissions: [],
            roles: {
                connect: { id: receptionistRole.id },
            },
        },
    });

    const multiRoleUser = await prisma.user.upsert({
        where: { username: 'multi' },
        update: {},
        create: {
            username: 'multi',
            displayName: 'محمد متعدد المهام',
            phoneNumber: '0912345681',
            password: await bcrypt.hash('multi123', 10),
            role: 'USER',
            permissions: [],
            roles: {
                connect: [
                    { id: accountantRole.id },
                    { id: receptionistRole.id },
                ],
            },
        },
    });

    console.log('✅ Users created successfully');

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📝 Test Users Created:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Username: admin       | Password: admin123');
    console.log('   Role: مدير النظام (All Permissions)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Username: accountant  | Password: acc123');
    console.log('   Role: محاسب (View Orders & Transactions)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Username: receptionist| Password: rec123');
    console.log('   Role: موظف استقبال (View & Add Orders)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Username: multi       | Password: multi123');
    console.log('   Roles: محاسب + موظف استقبال (Combined)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    });
