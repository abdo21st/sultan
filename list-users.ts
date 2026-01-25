import 'dotenv/config';
import { prisma } from "./lib/prisma";

async function main() {
    const users = await prisma.user.findMany({
        select: {
            username: true,
            displayName: true,
            role: true,
            phoneNumber: true,
            facilityId: true
        }
    });

    console.log("Found users:");
    users.forEach(u => {
        console.log(`- Username: ${u.username}, Name: ${u.displayName}, Role: ${u.role}, Phone: ${u.phoneNumber}`);
    });
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
