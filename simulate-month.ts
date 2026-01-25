
import 'dotenv/config';
import { prisma } from "./lib/prisma";
import bcrypt from 'bcryptjs';

const FACILITIES = [
    { name: "المصنع الرئيسي", type: "FACTORY", location: "المنطقة الصناعية" },
    { name: "فرع وسط البلد", type: "SHOP", location: "وسط البلد" },
    { name: "فرع حي الأندلس", type: "SHOP", location: "حي الأندلس" }
];

const ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'USER'];

async function main() {
    console.log("🚀 Starting Monthly Simulation...");

    // 1. Ensure Facilities Exist
    console.log("🏭 Setting up Facilities...");
    const facilityMap: Record<string, string> = {};
    for (const f of FACILITIES) {
        const fac = await prisma.facility.upsert({
            where: { id: f.name.replace(/\s/g, '_') }, // Using name as ID for simplicity in upsert if possible, but actually ID is cuid. Let's findFirst instead.
            update: {},
            create: { name: f.name, type: f.type, location: f.location }
        });
        // We can't really upsert by name easily without unique constraint. 
        // Let's just find first or create.
        const existing = await prisma.facility.findFirst({ where: { name: f.name } });
        let finalFac;
        if (existing) {
            finalFac = existing;
        } else {
            finalFac = await prisma.facility.create({ data: { name: f.name, type: f.type, location: f.location } });
        }
        facilityMap[f.type] = finalFac.id; // Store at least one of each type
        if (f.type === 'FACTORY') facilityMap['FACTORY_MAIN'] = finalFac.id;
        if (f.name === "فرع وسط البلد") facilityMap['SHOP_MAIN'] = finalFac.id;
    }

    // 2. Ensure Users Exist (Randomly generate some if not enough)
    console.log("busts Setting up Users...");
    const password = await bcrypt.hash('123123', 10);
    const usersToCreate = [
        { username: 'sim_admin', role: 'ADMIN', name: 'المدير العام' },
        { username: 'sim_factory_mgr', role: 'MANAGER', name: 'مدير المصنع', facilityId: facilityMap['FACTORY_MAIN'] },
        { username: 'sim_shop_emp', role: 'USER', name: 'موظف مبيعات', facilityId: facilityMap['SHOP_MAIN'] },
    ];

    for (const u of usersToCreate) {
        await prisma.user.upsert({
            where: { username: u.username },
            update: {},
            create: {
                username: u.username,
                password,
                displayName: u.name,
                role: u.role as any,
                facilityId: u.facilityId,
                phoneNumber: `091${Math.floor(Math.random() * 10000000)}`
            }
        });
    }

    // 3. Generate Orders for the past 30 days
    console.log("📦 Generating Orders & Transactions...");
    const statuses = ['REGISTERED', 'TRANSFERRED_TO_FACTORY', 'PROCESSING', 'TRANSFERRED_TO_SHOP', 'DELIVERING', 'COMPLETED'];
    const customers = ['أحمد محمد', 'سارة علي', 'شركة النور', 'مطعم السعادة', 'خالد يوسف'];

    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i); // Go back i days

        // Create 2-5 orders per day
        const dailyOrdersCount = Math.floor(Math.random() * 4) + 2;

        for (let j = 0; j < dailyOrdersCount; j++) {
            const customer = customers[Math.floor(Math.random() * customers.length)];
            const totalAmount = (Math.floor(Math.random() * 50) + 10) * 10; // 100 to 600

            // Randomly determine status based on how old the order is
            // Older orders are more likely to be COMPLETED
            let statusIndex = 0;
            if (i > 5) statusIndex = statuses.length - 1; // Completed
            else if (i > 2) statusIndex = Math.floor(Math.random() * (statuses.length - 2)) + 2; // Processing to Delivering
            else statusIndex = Math.floor(Math.random() * 3); // Registered to Processing

            const status = statuses[statusIndex];
            const isCompleted = status === 'COMPLETED';

            const order = await prisma.order.create({
                data: {
                    customerName: customer,
                    customerPhone: `092${Math.floor(Math.random() * 10000000)}`,
                    description: `طلب محاكاة رقم ${i}-${j}`,
                    dueDate: new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Due 3 days later
                    totalAmount,
                    paidAmount: isCompleted ? totalAmount : totalAmount * 0.2, // Full or Deposit
                    remainingAmount: isCompleted ? 0 : totalAmount * 0.8,
                    status,
                    factoryId: facilityMap['FACTORY_MAIN'],
                    shopId: facilityMap['SHOP_MAIN'],
                    images: [],
                    createdAt: date,
                    updatedAt: date
                }
            });

            // Create Transaction if some amount is paid
            if (order.paidAmount > 0) {
                await prisma.transaction.create({
                    data: {
                        type: 'INCOME',
                        category: 'SALES',
                        amount: order.paidAmount,
                        description: `دفعة للطلب #${order.serialNumber}`,
                        date: date,
                        createdAt: date
                    }
                });
            }

            // Create Notifications (Simulated)
            await prisma.notification.create({
                data: {
                    title: 'طلب جديد',
                    message: `تم إنشاء الطلب #${order.serialNumber}`,
                    link: `/orders/${order.id}`,
                    userId: null, // Broadcast-ish
                    createdAt: date,
                    read: true
                }
            });
        }

        // Random Expense
        if (Math.random() > 0.7) {
            await prisma.transaction.create({
                data: {
                    type: 'EXPENSE',
                    category: 'OPERATING',
                    amount: Math.floor(Math.random() * 100) * 10,
                    description: 'مصاريف تشغيلية يومية',
                    date: date,
                    createdAt: date
                }
            });
        }
    }

    console.log("✅ Simulation Complete!");
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
