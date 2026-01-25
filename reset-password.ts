import 'dotenv/config';
import { prisma } from "./lib/prisma";
import bcrypt from 'bcryptjs';

async function main() {
    const username = process.argv[2];
    const newPassword = process.argv[3] || '123123';

    if (!username) {
        console.error("Please provide a username.");
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { username },
        data: { password: hashedPassword }
    });

    console.log(`Password for user '${username}' has been reset to '${newPassword}'`);
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
