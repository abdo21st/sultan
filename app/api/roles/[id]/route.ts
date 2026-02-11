import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "../../../../lib/permissions";

const roleSchema = z.object({
    name: z.string().min(2).optional(),
    displayName: z.string().min(2).optional(),
    description: z.string().optional(),
    permissions: z.array(z.string()).optional(),
});

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.permissions?.includes(PERMISSIONS.ROLES_MANAGE)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const json = await req.json();
        const result = roleSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const role = await prisma.customRole.update({
            where: { id },
            data: result.data
        });

        return NextResponse.json(role);
    } catch {
        return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    // 1. Authentication & Permission Check
    if (!session?.user?.permissions?.includes(PERMISSIONS.ROLES_MANAGE)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { id } = await params;

        // 2. Check if role is assigned to any users
        const roleToDelete = await prisma.customRole.findUnique({
            where: { id },
            include: { _count: { select: { users: true } } }
        });

        if (!roleToDelete) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 });
        }

        if (roleToDelete._count.users > 0) {
            return NextResponse.json({
                error: `Cannot delete role because it is assigned to ${roleToDelete._count.users} users.`
            }, { status: 400 });
        }

        await prisma.customRole.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete role error:", error);
        return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
    }
}
