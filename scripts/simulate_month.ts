import 'dotenv/config';
import { prisma } from '../lib/prisma';


const USERS = [
    {
        username: 'manager_factory',
        password: 'password123',
        displayName: 'مدير المصنع',
        role: 'USER', // Will assign custom role later
        roleName: 'FACTORY_MANAGER'
    },
    {
        username: 'manager_shop',
        password: 'password123',
        displayName: 'مدير المحل',
        role: 'USER',
        roleName: 'SHOP_MANAGER'
    },
    {
        username: 'driver_1',
        password: 'password123',
        displayName: 'السائق أحمد',
        role: 'USER',
        roleName: 'DRIVER'
    },
    {
        username: 'accountant_1',
        password: 'password123',
        displayName: 'المحاسب محمد',
        role: 'ACCOUNTANT',
        roleName: 'ACCOUNTANT'
    }
];

const ROLES = {
    FACTORY_MANAGER: {
        name: 'FACTORY_MANAGER',
        displayName: 'مدير مصنع',
        permissions: ['orders:view', 'orders:add', 'orders:edit', 'facilities:view']
    },
    SHOP_MANAGER: {
        name: 'SHOP_MANAGER',
        displayName: 'مدير محل',
        permissions: ['orders:view', 'orders:add', 'users:view'] // Simplified
    },
    DRIVER: {
        name: 'DRIVER',
        displayName: 'سائق',
        permissions: ['orders:view']
    },
    ACCOUNTANT: {
        name: 'ACCOUNTANT',
        displayName: 'محاسب',
        permissions: ['transactions:view', 'transactions:add', 'orders:view_financials']
    }
};

async function main() {
    console.log('Starting simulation...');

    // 1. Setup Roles and Users
    for (const userDef of USERS) {
        // Create Role
        const roleDef = ROLES[userDef.roleName as keyof typeof ROLES];
        let role = await prisma.customRole.findUnique({ where: { name: roleDef.name } });
        if (!role) {
            role = await prisma.customRole.create({
                data: {
                    name: roleDef.name,
                    displayName: roleDef.displayName,
                    permissions: roleDef.permissions
                }
            });
            console.log(`Created role: ${role.name}`);
        }

        // Create User
        // Note: Password hashing omitted for simulation - in real app use bcrypt
        const exists = await prisma.user.findUnique({ where: { username: userDef.username } });
        if (!exists) {
            await prisma.user.create({
                data: {
                    username: userDef.username,
                    password: userDef.password, // Ideally hash this
                    displayName: userDef.displayName,
                    roleId: role.id
                }
            });
            console.log(`Created user: ${userDef.username}`);
        }
    }

    // 2. Simulate 30 Days of Activity
    const statuses = ['REGISTERED', 'In Factory', 'Ready for Delivery', 'DELIVERING', 'COMPLETED', 'REVIEW_NEEDED'];

    // Create dummy facility IDs (assuming they exist or creating them)
    let factory = await prisma.facility.findFirst({ where: { type: 'FACTORY' } });
    if (!factory) {
        factory = await prisma.facility.create({ data: { name: 'Main Factory', type: 'FACTORY' } });
    }
    let shop = await prisma.facility.findFirst({ where: { type: 'SHOP' } });
    if (!shop) {
        shop = await prisma.facility.create({ data: { name: 'Main Shop', type: 'SHOP' } });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        console.log(`Simulating day ${i + 1}: ${currentDate.toISOString().split('T')[0]}`);

        // 5-10 Orders per day
        const dailyOrders = Math.floor(Math.random() * 5) + 5;
        for (let j = 0; j < dailyOrders; j++) {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const total = Math.floor(Math.random() * 500) + 100;

            await prisma.order.create({
                data: {
                    customerName: `Customer ${i}-${j}`,
                    customerPhone: '0500000000',
                    description: `Order Description ${i}-${j}`,
                    dueDate: new Date(currentDate.getTime() + 86400000 * 3).toISOString().split('T')[0], // +3 days
                    status: status,
                    totalAmount: total,
                    paidAmount: status === 'COMPLETED' ? total : 0,
                    factoryId: factory.id,
                    shopId: shop.id,
                    createdAt: currentDate,
                    updatedAt: currentDate
                }
            });
        }

        // 2-3 Transactions
        if (i % 2 === 0) {
            await prisma.transaction.create({
                data: {
                    type: 'EXPENSE',
                    amount: Math.floor(Math.random() * 200),
                    category: 'Fuel',
                    description: 'Daily Fuel',
                    date: currentDate,
                    createdAt: currentDate
                }
            });
        }
    }

    console.log('Simulation complete.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
