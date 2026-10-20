import { Prisma } from "@prisma/client";

type AuditClient = Prisma.TransactionClient;

function snapshot(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAudit(
    tx: AuditClient,
    event: {
        actorId: string | null;
        entityType: string;
        entityId: string;
        action: string;
        before?: unknown;
        after?: unknown;
    },
) {
    const entry = await tx.auditLog.create({
        data: {
            actorId: event.actorId,
            entityType: event.entityType,
            entityId: event.entityId,
            action: event.action,
            ...(event.before !== undefined ? { before: snapshot(event.before) } : {}),
            ...(event.after !== undefined ? { after: snapshot(event.after) } : {}),
        },
    });
    return entry.id;
}
