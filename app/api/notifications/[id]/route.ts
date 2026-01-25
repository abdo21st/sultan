import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        // Verify ownership
        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification || notification.userId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { read: true }
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to update notification" },
            { status: 500 }
        );
    }
}
