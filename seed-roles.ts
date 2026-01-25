
import 'dotenv/config';
import { prisma } from "./lib/prisma";
import { DEFAULT_ROLES } from "./lib/permissions";

const ROLE_DISPLAY_NAMES: Record<string, string> = {
    ADMIN: "مدير النظام",
    MANAGER: "مشرف / مدير فرع",
    ACCOUNTANT: "محاسب",
    USER: "مستخدم عادي / موظف مبيعات"
};

async function main() {
    console.log("🌱 Seeding Roles...");

    for (const [roleName, permissions] of Object.entries(DEFAULT_ROLES)) {
        await prisma.customRole.upsert({
            where: { name: roleName },
            update: {
                permissions: permissions
            },
            create: {
                name: roleName,
                displayName: ROLE_DISPLAY_NAMES[roleName] || roleName,
                permissions: permissions
            }
        });
        console.log(`✅ Upserted Role: ${roleName}`);
    }

    console.log("Roles seeded successfully.");
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
