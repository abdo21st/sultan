import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
    const session = await auth();
    // STRICT: Only ADMIN can do this. Not just SETTINGS_MANAGE.
    // Factory reset is dangerous.
    if (!session?.user || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const currentUserId = session.user.id;

    try {
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

            // Delete roles (except if any are hardcoded/system? No, we use CustomRole)
            // But we must check if the current user relies on a CustomRole.
            // Ideally, the 'ADMIN' role is an Enum in the User model, so it's safe.
            // But if they have a roleId pointing to a CustomRole, we shouldn't delete that role.

            // For safety, let's keep all roles or just delete ones not used?
            // "Factory Reset" usually implies clearing configuration too.
            // Let's delete all roles. If the admin relies on one, we might need to detach it.
            // The schema says `role Role @default(USER)` (Enum) AND `roleRel CustomRole?`.
            // If the user is ADMIN (Enum), they don't strictly *need* the CustomRole object for basic access if our logic falls back to Enum.

            // Let's detach the role from the current user first if it exists, just in case.
            await tx.user.update({
                where: { id: currentUserId },
                data: {
                    roles: { set: [] },
                    role: 'ADMIN'
                } // Ensure they stay ADMIN
            });

            await tx.customRole.deleteMany({});
        });

        return NextResponse.json({ success: true, message: "Factory reset complete" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Factory reset failed" }, { status: 500 });
    }
}
