import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId: session.user.id,
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20
        });

        // Count unread
        const unreadCount = await prisma.notification.count({
            where: {
                userId: session.user.id,
                read: false
            }
        });

        return NextResponse.json({ notifications, unreadCount });
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch notifications" },
            { status: 500 }
        );
    }
}
