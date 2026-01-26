import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const createPrismaClient = () => {
    const url = process.env.DATABASE_URL

    // In Prisma 7, the constructor property is 'datasourceUrl'.
    // We provide a fallback to avoid "Initialization Error" during Vercel builds.
    return new PrismaClient({
        // @ts-expect-error - 'datasourceUrl' is the correct Prisma 7 property
        datasourceUrl: url || "postgresql://postgres:postgres@localhost:5432/postgres"
    })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
