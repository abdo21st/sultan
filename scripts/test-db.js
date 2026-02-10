require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

async function main() {
    const connectionString = process.env.DATABASE_URL;
    console.log('Testing connection to:', connectionString ? 'URL provided' : 'No URL found');

    if (!connectionString) {
        console.error('Error: DATABASE_URL is not defined in .env');
        process.exit(1);
    }

    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const userCount = await prisma.user.count();
        console.log('✅ Connection successful! User count:', userCount);
    } catch (error) {
        console.error('❌ Connection failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main();
