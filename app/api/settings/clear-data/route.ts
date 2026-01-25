
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user ||
        (session.user.role !== 'ADMIN' && !(session.user as any).permissions?.includes(PERMISSIONS.SETTINGS_MANAGE))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await prisma.$transaction([
            prisma.order.deleteMany({}),
            prisma.transaction.deleteMany({}),
            prisma.notification.deleteMany({})
        ]);

        return NextResponse.json({ success: true, message: "Operational data cleared successfully" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }
}
