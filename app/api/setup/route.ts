import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '@/lib/permissions';

export async function POST() {
    try {
        console.log('🌱 Starting setup...');

        // 1. Create Roles
        const adminRole = await prisma.customRole.upsert({
            where: { name: 'SUPER_ADMIN' },
            update: {},
            create: {
                name: 'SUPER_ADMIN',
                displayName: 'مدير النظام',
                permissions: Object.values(PERMISSIONS),
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

        // 2. Create Users
        const hashedPassword = await bcrypt.hash('admin123', 10);

        const adminUser = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: {
                username: 'admin',
                displayName: 'المدير العام',
                phoneNumber: '0912345678',
                password: hashedPassword,
                role: 'ADMIN',
                permissions: Object.values(PERMISSIONS),
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

        return NextResponse.json({
            success: true,
            message: 'تم إنشاء المستخدمين والأدوار بنجاح',
            users: [
                { username: 'admin', password: 'admin123', role: 'مدير النظام' },
                { username: 'accountant', password: 'acc123', role: 'محاسب' },
                { username: 'receptionist', password: 'rec123', role: 'موظف استقبال' },
                { username: 'multi', password: 'multi123', role: 'محاسب + موظف استقبال' },
            ],
        });
    } catch (error) {
        console.error('Setup error:', error);
        return NextResponse.json(
            { error: 'فشل الإعداد', details: String(error) },
            { status: 500 }
        );
    }
}
