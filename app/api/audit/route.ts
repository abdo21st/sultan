import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { getRequestUser } from "@/lib/request-user";

export async function GET(request: Request) {
    const user = await getRequestUser();
    if (!user?.permissions.includes(PERMISSIONS.AUDIT_VIEW)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: user ? 403 : 401 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const cursor = searchParams.get("cursor");
    const parsedLimit = Number(searchParams.get("limit") || 50);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return NextResponse.json({ error: "Limit must be between 1 and 100." }, { status: 400 });
    }

    const where: Prisma.AuditLogWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const entries = await prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: parsedLimit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = entries.length > parsedLimit;
    const items = hasMore ? entries.slice(0, parsedLimit) : entries;
    return NextResponse.json({ items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null });
}
