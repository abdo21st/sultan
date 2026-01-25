
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await params;
        const body = await req.json();
        const { name, displayName, permissions } = body;

        const role = await prisma.customRole.update({
            where: { id },
            data: {
                name,
                displayName,
                permissions
            }
        });
        return NextResponse.json(role);
    } catch (error) {
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
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
    }
}
