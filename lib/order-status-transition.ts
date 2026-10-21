import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";

export async function persistOrderStatusTransition(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    actorId: string;
    currentStatus: string;
    newStatus: string;
    rejectionReason?: string;
  },
) {
  const rejectionReason = input.rejectionReason || null;
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${input.orderId} FOR UPDATE`;
  if (await tx.orderAdjustment.findFirst({ where: { orderId: input.orderId, status: { in: ['REQUESTED', 'APPROVED'] } } })) return false;
  const updated = await tx.order.updateMany({
    where: { id: input.orderId, status: input.currentStatus },
    data: { status: input.newStatus, rejectionReason },
  });
  if (updated.count !== 1) return false;

  await writeAudit(tx, {
    actorId: input.actorId,
    entityType: "ORDER",
    entityId: input.orderId,
    action: "STATUS_CHANGED",
    before: { status: input.currentStatus },
    after: { status: input.newStatus, rejectionReason },
  });
  return true;
}
