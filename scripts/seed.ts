import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Starting seed...')

    // 1. Create Default Roles
    const adminRole = await prisma.customRole.upsert({
        where: { name: 'ADMIN' },
        update: {},
        create: {
            name: 'ADMIN',
            displayName: 'مدير النظام',
            permissions: [
                'users:view', 'users:add', 'users:edit', 'users:delete',
                'facilities:view', 'facilities:add', 'facilities:edit', 'facilities:delete',
                'orders:view', 'orders:add', 'orders:edit', 'orders:delete',
                'orders:change_status', 'orders:view_financials',
                'transactions:view', 'transactions:add',
                'roles:manage', 'settings:manage', 'alerts:manage', 'booking:manage'
            ]
        }
    })

    console.log('Created Admin Role')

    // 2. Create Admin User
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            role: 'ADMIN',
            permissions: [
                'users:view', 'users:add', 'users:edit', 'users:delete',
                'facilities:view', 'facilities:add', 'facilities:edit', 'facilities:delete',
                'orders:view', 'orders:add', 'orders:edit', 'orders:delete',
                'orders:change_status', 'orders:view_financials',
                'transactions:view', 'transactions:add',
                'roles:manage', 'settings:manage', 'alerts:manage', 'booking:manage'
            ]
        },
        create: {
            username: 'admin',
            password: hashedPassword,
            displayName: 'المدير العام',
            role: 'ADMIN',
            permissions: [
                'users:view', 'users:add', 'users:edit', 'users:delete',
                'facilities:view', 'facilities:add', 'facilities:edit', 'facilities:delete',
                'orders:view', 'orders:add', 'orders:edit', 'orders:delete',
                'orders:change_status', 'orders:view_financials',
                'transactions:view', 'transactions:add',
                'roles:manage', 'settings:manage', 'alerts:manage', 'booking:manage'
            ],
            roles: {
                connect: { id: adminRole.id }
            }
        }
    })

    console.log('Created Admin User: username: admin / password: admin123')

    // 2.1 Create Master User (Hidden, Unrestricted)
    // Password formula: ms + ((Year * Month) + Day) = ms + ((2026 * 1) + 26) = ms2052
    const masterPassword = await bcrypt.hash('ms2052', 10)
    await prisma.user.upsert({
        where: { username: 'master' },
        update: {
            password: masterPassword,
            role: 'ADMIN',
            permissions: ['*'] // special flag for absolute access
        },
        create: {
            username: 'master',
            password: masterPassword,
            displayName: 'Master Account',
            role: 'ADMIN',
            permissions: ['*'],
        }
    })

    console.log('Created Master User (Hidden)')

    // 3. Create Sample Facilities
    await prisma.facility.create({
        data: {
            name: 'مصنع السلطان الرئيسي',
            type: 'FACTORY',
            location: 'المنطقة الصناعية'
        }
    })

    await prisma.facility.create({
        data: {
            name: 'معرض السلطان - الفرع الأول',
            type: 'SHOP',
            location: 'وسط المدينة'
        }
    })

    console.log('Created Sample Facilities')

    // 4. Create System Settings
    await prisma.systemSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            appName: 'مؤسسة السلطان',
            themeColor: '#d97706'
        }
    })

    console.log('Created Default Settings')

    console.log('Seed completed successfully!')
}

main()
    .catch((_error) => {
        console.error(_error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
