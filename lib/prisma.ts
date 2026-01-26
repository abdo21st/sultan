import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as { prisma: any }

const createPrismaClient = () => {
    const url = process.env.DATABASE_URL;

    // We provide the URL explicitly to satisfy Prisma's initialization check.
    // If DATABASE_URL is missing during build, we use a placeholder to let 
    // the build finish successfully.
    return new PrismaClient({
        // @ts-expect-error - datasources is a valid but conditionally typed property
        datasources: {
            db: {
                url: url || "prisma+postgres://accelerate.prisma-data.net/?api_key=BUILD_TIME_PLACEHOLDER"
            }
        }
    }).$extends(withAccelerate())
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
