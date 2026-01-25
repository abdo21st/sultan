import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function migrate() {
    console.log('🚀 Starting date migration...');
    const orders = await prisma.order.findMany();

    for (const order of orders) {
        // Current format is usually "YYYY-MM-DD"
        // We will store it temporarily or just ensure we can convert it.
        // Actually, Prisma db push will try to cast it. 
        // To be safe, let's just log and verify if anything is non-standard.
        const date = new Date(order.dueDate);
        if (isNaN(date.getTime())) {
            console.log(`⚠️ Invalid date for order ${order.id}: ${order.dueDate}. Setting to now.`);
            await prisma.order.update({
                where: { id: order.id },
                data: { dueDate: new Date().toISOString().split('T')[0] }
            });
        }
    }
    console.log('✅ Pre-migration check complete.');
    await prisma.$disconnect();
}

migrate();
