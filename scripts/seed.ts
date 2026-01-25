import 'dotenv/config';
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

    await prisma.customRole.upsert({
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

    await prisma.user.upsert({
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

    await prisma.user.upsert({
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

    await prisma.user.upsert({
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

    await prisma.user.upsert({
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

    // 3. Create Facilities
    console.log('🏭 Creating facilities...');
    const mainFactory = await prisma.facility.upsert({
        where: { id: 'factory-1' },
        update: {},
        create: {
            id: 'factory-1',
            name: 'المصنع الرئيسي',
            type: 'FACTORY',
            location: 'المنطقة الصناعية',
        },
    });

    const centralShop = await prisma.facility.upsert({
        where: { id: 'shop-1' },
        update: {},
        create: {
            id: 'shop-1',
            name: 'معرض المدينة',
            type: 'SHOP',
            location: 'وسط المدينة',
        },
    });

    // 4. Create Sample Orders
    console.log('📦 Creating sample orders...');

    // Order 1: Registered by Admin
    await prisma.order.create({
        data: {
            customerName: 'محمد علي',
            customerPhone: '0912345600',
            description: 'طقم جلوس كلاسيك',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            totalAmount: 50000,
            paidAmount: 20000,
            remainingAmount: 30000,
            factoryId: mainFactory.id,
            shopId: centralShop.id,
            status: 'REGISTERED',
        },
    });

    // Order 2: In Production
    await prisma.order.create({
        data: {
            customerName: 'سارة أحمد',
            customerPhone: '0912345601',
            description: 'مطبخ ألمنيوم حديث',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            totalAmount: 120000,
            paidAmount: 80000,
            remainingAmount: 40000,
            factoryId: mainFactory.id,
            shopId: centralShop.id,
            status: 'IN_PRODUCTION',
        },
    });

    console.log('✅ Sample data added successfully');

    console.log('\n🎉 Seed completed successfully!');
    // ... rest of console logs
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    });
