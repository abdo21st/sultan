import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { getRequestUser } from "@/lib/request-user";
import { enqueueBlobDeletions, processBlobDeletionQueue } from "@/lib/blob-cleanup";
import { DESTRUCTIVE_CONFIRMATIONS } from "@/lib/constants";

export async function POST(request: Request) {
    try {
        const user = await getRequestUser();
        // STRICT: Only ADMIN can do this. Not just SETTINGS_MANAGE.
        // Factory reset is dangerous.
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const body = await request.json().catch(() => null);
        if (body?.confirmation !== DESTRUCTIVE_CONFIRMATIONS.FACTORY_RESET) {
            return NextResponse.json({ error: "Explicit confirmation is required" }, { status: 400 });
        }

        const currentUserId = user.id;

        // We use a transaction to ensure atomicity
        await prisma.$transaction(async (tx) => {
            const [orders, transactions, users, facilities] = await Promise.all([
                tx.order.count(),
                tx.transaction.count(),
                tx.user.count(),
                tx.facility.count(),
            ]);
            await writeAudit(tx, {
                actorId: currentUserId,
                entityType: "SYSTEM",
                entityId: "factory-reset",
                action: "FACTORY_RESET",
                before: { orders, transactions, users, facilities },
            });
            let cursor: string | undefined;
            while (true) {
                const batch = await tx.order.findMany({
                    select: { id: true, images: true },
                    orderBy: { id: "asc" },
                    take: 100,
                    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
                });
                if (batch.length === 0) break;
                for (const order of batch) {
                    await enqueueBlobDeletions(tx, order.images, order.id);
                }
                cursor = batch[batch.length - 1].id;
                if (batch.length < 100) break;
            }
            // Delete everything
            await tx.transaction.deleteMany({});
            await tx.order.deleteMany({});
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

        await processBlobDeletionQueue({ limit: 100 }).catch(() => {
            console.error("Factory-reset image cleanup was deferred to the retry queue.");
        });

        return NextResponse.json({ success: true, message: "Factory reset complete" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Factory reset failed" }, { status: 500 });
    }
}
