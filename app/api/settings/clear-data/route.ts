import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";
import { enqueueBlobDeletions, processBlobDeletionQueue } from "@/lib/blob-cleanup";
import { NextResponse } from "next/server";
import { DESTRUCTIVE_CONFIRMATIONS } from "@/lib/constants";

export async function POST(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!user.permissions.includes(PERMISSIONS.DATA_CLEAR)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const body = await request.json().catch(() => null);
        if (body?.confirmation !== DESTRUCTIVE_CONFIRMATIONS.CLEAR_OPERATIONAL_DATA) {
            return NextResponse.json({ error: "Explicit confirmation is required" }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            const [orders, transactions, notifications] = await Promise.all([
                tx.order.count(),
                tx.transaction.count(),
                tx.notification.count(),
            ]);
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "SYSTEM",
                entityId: "operational-data",
                action: "DATA_CLEARED",
                before: { orders, transactions, notifications },
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
            await tx.transaction.deleteMany({});
            await tx.order.deleteMany({});
            await tx.notification.deleteMany({});
        });

        await processBlobDeletionQueue({ limit: 100 }).catch(() => {
            console.error("Data-clearing image cleanup was deferred to the retry queue.");
        });

        return NextResponse.json({ success: true, message: "Operational data cleared successfully" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }
}
