import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function checkMaster() {
    const user = await prisma.user.findUnique({
        where: { username: 'master' }
    })

    if (!user) {
        console.log('User master NOT FOUND')
        return
    }

    const passwordToTest = 'ms2052'
    const match = await bcrypt.compare(passwordToTest, user.password)

    console.log('Master user found:')
    console.log('Username:', user.username)
    console.log('Hash in DB:', user.password)
    console.log('Testing against "ms2052":', match ? 'MATCH ✔' : 'FAILURE ❌')
}

checkMaster()
    .finally(() => prisma.$disconnect())
