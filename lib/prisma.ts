import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// During Vercel build, the environment variables might not be fully loaded.
// Prisma 7 requires a non-empty connection string to initialize.
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
}

const createPrismaClient = () => {
    return new PrismaClient()
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
