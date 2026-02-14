import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const session = await auth();
        // STRICT: Only ADMIN can do this. Not just SETTINGS_MANAGE.
        // Factory reset is dangerous.
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const currentUserId = session.user.id;

        // We use a transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
            // Delete everything
            await tx.order.deleteMany({});
            await tx.transaction.deleteMany({});
            await tx.notification.deleteMany({});
            await tx.facility.deleteMany({});

            // Delete users except current admin
            await tx.user.deleteMany({
                where: {
                    NOT: {
                        id: currentUserId
                    }
                }
            });

            // Detach roles from the current user first
            await tx.user.update({
                where: { id: currentUserId },
                data: {
                    roles: { set: [] },
                    role: 'ADMIN'
                }
            });

            await tx.customRole.deleteMany({});
        });

        return NextResponse.json({ success: true, message: "Factory reset complete" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Factory reset failed" }, { status: 500 });
    }
}
