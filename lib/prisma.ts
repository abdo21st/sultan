import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Globalize the connection pool to prevent "too many clients" and improve reuse
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined,
    pool: pg.Pool | undefined
}

const createPrismaClient = () => {
    const connectionString = process.env.DATABASE_URL || ""

    if (!globalForPrisma.pool) {
        globalForPrisma.pool = new pg.Pool({
            connectionString: connectionString,
            max: connectionString.includes('pooler') ? 1 : 10, // Optimize for pooler vs direct
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 60000,
            ssl: { rejectUnauthorized: false }
        })
        console.log("Prisma: Initialized Global PG Pool");
    }

    const adapter = new PrismaPg(globalForPrisma.pool)
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
