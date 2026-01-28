import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Globalize the connection pool to prevent "too many clients" and improve reuse
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined,
    pool: pg.Pool | undefined
}

const createPrismaClient = () => {
    const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres"

    if (!globalForPrisma.pool) {
        globalForPrisma.pool = new pg.Pool({
            connectionString,
            max: 10,        // Optimization for serverless
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 60000, // Increased for local/test stability
        })
        console.log("Creating new PG Pool with timeout 60s");
    }

    const adapter = new PrismaPg(globalForPrisma.pool)
    return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}
