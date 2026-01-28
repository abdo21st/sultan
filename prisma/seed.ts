import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const password = await bcrypt.hash('master', 10);

    const user = await prisma.user.upsert({
        where: { username: 'master' },
        update: {
            password: password,
            role: 'ADMIN',
        },
        create: {
            username: 'master',
            displayName: 'Master Admin',
            password: password,
            role: 'ADMIN',
            permissions: [],
        },
    });

    console.log({ user });

    // Seed Facilities
    const factory = await prisma.facility.create({
        data: {
            name: 'Main Factory',
            type: 'FACTORY',
            location: 'Industrial Area',
        }
    });

    const shop = await prisma.facility.create({
        data: {
            name: 'Main Shop',
            type: 'SHOP',
            location: 'Downtown',
        }
    });

    console.log({ factory, shop });
}

main()
    .then(async () => {
        await prisma.$disconnect();
        await pool.end();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        await pool.end();
        process.exit(1);
    });
