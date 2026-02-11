import 'dotenv/config';
import { prisma } from '../lib/prisma';

async function main() {
    const users = await prisma.user.findMany({
        where: {
            role: 'USER'
        },
        select: {
            id: true,
            username: true,
            displayName: true,
            role: true,
            permissions: true
        }
    });

    console.log('Found', users.length, 'users with role USER');
    users.forEach(u => {
        console.log(`User: ${u.username} (${u.displayName})`);
        console.log(`Explicit Permissions:`, u.permissions);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
