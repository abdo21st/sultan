import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getRequestUser } from "@/lib/request-user";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getRequestUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;

        // Verify ownership
        const updated = await prisma.notification.updateMany({
            where: { id, userId: user.id },
            data: { read: true },
        });
        if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json(
            { error: "Failed to update notification" },
            { status: 500 }
        );
    }
}
