
import { prisma } from "../../../lib/prisma";
import { NextResponse } from "next/server";
import { PERMISSIONS } from "../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";

export async function GET() {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.permissions.includes(PERMISSIONS.ROLES_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const roles = await prisma.customRole.findMany({
            include: {
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(roles);
    } catch {
        return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }
}

import { z } from "zod";

const roleSchema = z.object({
    name: z.string().min(2, "اسم البرمجي للدور يجب أن يكون حرفين على الأقل (مثال: MANAGER)"),
    displayName: z.string().min(2, "اسم الدور الظاهر يجب أن يكون حرفين على الأقل (مثال: مدير)"),
    description: z.string().optional(),
    permissions: z.array(z.string().min(1).max(120)).max(100).default([]).refine((permissions) => !permissions.includes("*"), "Wildcard permissions are not allowed."),
});

export async function POST(req: Request) {
    const user = await getRequestUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!user.permissions.includes(PERMISSIONS.ROLES_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const json = await req.json();
        const result = roleSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const { name, displayName, description, permissions } = body;

        const role = await prisma.$transaction(async (tx) => {
            const created = await tx.customRole.create({
                data: {
                name,
                displayName,
                description,
                permissions: permissions || []
                }
            });
            await writeAudit(tx, { actorId: user.id, entityType: "ROLE", entityId: created.id, action: "CREATED", after: created });
            return created;
        });
        return NextResponse.json(role);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
    }
}
