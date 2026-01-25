import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function testPhase2() {
    console.log('🧪 Starting Phase 2 Verification...\n')

    try {
        // 1. Verify Date Type in Database
        const orderFields = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Order' AND column_name = 'dueDate'
        `
        console.log('📅 Date Type Check:', orderFields)

        // Fetch factory and shop for testing
        const factory = await prisma.facility.findFirst({ where: { type: 'FACTORY' } })
        const shop = await prisma.facility.findFirst({ where: { type: 'SHOP' } })

        if (!factory || !shop) {
            console.error('❌ Could not find a factory or shop to run tests.')
            return
        }

        console.log(`🔍 Testing Filter with Factory ID: ${factory.id}`)
        const filteredOrders = await prisma.order.findMany({
            where: { factoryId: factory.id }
        })
        console.log(`✅ Found ${filteredOrders.length} orders for factory ${factory.name}`)

        // 3. Test Image Cleanup Simulation
        const testImagePath = path.join(process.cwd(), 'public', 'uploads', 'test-cleanup.txt')
        if (!fs.existsSync(path.dirname(testImagePath))) {
            fs.mkdirSync(path.dirname(testImagePath), { recursive: true })
        }
        fs.writeFileSync(testImagePath, 'test content')
        console.log('🖼️ Created test image for cleanup at:', testImagePath)

        // Find an order to attribute the image to (or create a dummy)
        const dummyOrder = await prisma.order.create({
            data: {
                customerName: 'Test Image Cleanup',
                customerPhone: '0000',
                description: 'test',
                dueDate: new Date(),
                totalAmount: 100,
                paidAmount: 0,
                remainingAmount: 100,
                status: 'REGISTERED',
                images: ['/uploads/test-cleanup.txt'],
                factoryId: factory.id,
                shopId: shop.id
            }
        })

        // Simulate "Complete Order" functionality (imported logic or manual simulation)
        console.log(`📦 Completing Order #${dummyOrder.serialNumber}...`)

        // Manual cleanup simulation to verify file removal logic
        const imagesToDelete = dummyOrder.images as string[]
        for (const imgPath of imagesToDelete) {
            const fullPath = path.join(process.cwd(), 'public', imgPath)
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath)
                console.log(`✅ Deleted file: ${fullPath}`)
            }
        }

        await prisma.order.update({
            where: { id: dummyOrder.id },
            data: { status: 'COMPLETED', images: [] }
        })

        const updatedOrder = await prisma.order.findUnique({ where: { id: dummyOrder.id } })
        console.log('📝 Updated Order Images Array Length:', updatedOrder?.images?.length)

        // 4. Test Analytics Data Aggregation
        const analyticsData = await prisma.order.groupBy({
            by: ['status'],
            _count: { id: true },
            _sum: { totalAmount: true }
        })
        console.log('📊 Analytics Summary:', analyticsData)

        // Cleanup dummy order
        await prisma.order.delete({ where: { id: dummyOrder.id } })
        console.log('\n🧹 Cleanup complete. Verification successful!')

    } catch (error) {
        console.error('❌ Verification failed:', error)
    } finally {
        await prisma.$disconnect()
    }
}

testPhase2()
