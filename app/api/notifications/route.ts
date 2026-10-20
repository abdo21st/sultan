import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getRequestUser } from "@/lib/request-user";

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId: user.id,
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20
        });

        // Count unread
        const unreadCount = await prisma.notification.count({
            where: {
                userId: user.id,
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
