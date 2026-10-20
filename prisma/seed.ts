import { config as loadEnv } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { PERMISSIONS } from '../lib/permissions'
import { newPasswordSchema } from '../lib/password-policy'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ path: '.env', quiet: true })

const connectionString = process.env.DATABASE_URL || ""
const pool = new pg.Pool({
  connectionString,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding...')

  // Create an initial administrator only when explicitly configured. Never reset an
  // existing account's password during a routine seed run.
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin'
  const admin = await prisma.user.findUnique({ where: { username: adminUsername } })
  if (!admin) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD
    if (!initialPassword || !newPasswordSchema.safeParse(initialPassword).success) {
      throw new Error('Set INITIAL_ADMIN_PASSWORD (at least 12 characters) to create the initial administrator.')
    }
    const { default: bcrypt } = await import('bcryptjs')
    await prisma.user.create({
      data: {
        username: adminUsername,
        password: await bcrypt.hash(initialPassword, 12),
        mustChangePassword: true,
        displayName: process.env.INITIAL_ADMIN_DISPLAY_NAME || 'مدير النظام',
        role: 'ADMIN',
        permissions: Object.values(PERMISSIONS),
      },
    })
    console.log('Created initial administrator:', adminUsername)
  } else {
    console.log('Initial administrator already exists; left credentials unchanged.')
  }

  // Create default shop and factory
  const shop = await prisma.facility.findFirst({ where: { name: 'المحل الرئيسي', type: 'SHOP' } }) ?? await prisma.facility.create({
    data: {
      name: 'المحل الرئيسي',
      type: 'SHOP',
      location: 'المركز',
    }
  })
  console.log('Created Shop:', shop.name)

  const factory = await prisma.facility.findFirst({ where: { name: 'المصنع الرئيسي', type: 'FACTORY' } }) ?? await prisma.facility.create({
    data: {
      name: 'المصنع الرئيسي',
      type: 'FACTORY',
      location: 'المنطقة الصناعية',
    }
  })
  console.log('Created Factory:', factory.name)

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
