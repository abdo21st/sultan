import { PrismaClient } from '@prisma/client'
const createPrismaClient = () => {
    const url = process.env.DATABASE_URL

    // In Prisma 7, if the environment variable is missing during build, 
    // we must provide a fallback to satisfy the "non-empty" requirement.
    return new PrismaClient({
        // @ts-expect-error - Providing url via constructor config
        datasources: {
            db: {
                url: url || "postgresql://postgres:postgres@localhost:5432/postgres"
            }
        }
    })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
