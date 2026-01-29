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
    { params }: { params: { id: string } }
) {
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
            where: { id: params.id },
            data: result.data
        });

        return NextResponse.json(role);
    } catch {
        return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await params;
        // Check if users are assigned? Maybe block delete.
        // For now, let's just delete. Prisma might error if Foreign Key constraint fails (if we had strictly enforced it, but we made it optional on user side for now).
        // Actually we defined `roleRel CustomRole?` on User.

        await prisma.customRole.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
    }
}
