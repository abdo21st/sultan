import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'
import { PERMISSIONS } from '../lib/permissions'

const connectionString = process.env.DATABASE_URL || ""
const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding...')

  // Create Admin User
  const adminPassword = await bcrypt.hash('12341312', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: adminPassword,
      permissions: Object.values(PERMISSIONS),
    },
    create: {
      username: 'admin',
      password: adminPassword,
      displayName: 'مدير النظام',
      role: 'ADMIN',
      permissions: Object.values(PERMISSIONS),
    },
  })
  console.log('Created Admin user:', admin.username)

  // Also create 'master' for absolute access if needed, or just make admin the master
  const masterPassword = await bcrypt.hash('12341312', 10)
  await prisma.user.upsert({
    where: { username: 'master' },
    update: { password: masterPassword },
    create: {
      username: 'master',
      password: masterPassword,
      displayName: 'Master',
      role: 'ADMIN',
      permissions: [],
    },
  })

  // Create default shop and factory
  const shop = await prisma.facility.create({
    data: {
      name: 'المحل الرئيسي',
      type: 'SHOP',
      location: 'المركز',
    }
  })
  console.log('Created Shop:', shop.name)

  const factory = await prisma.facility.create({
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
  })
