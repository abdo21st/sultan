import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    // Basic protection using a header (optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // Perform a simple query to keep the database active
        const count = await prisma.user.count();

        return NextResponse.json({
            success: true,
            message: "Database pinged successfully",
            timestamp: new Date().toISOString(),
            data: { userCount: count }
        });
    } catch (error: any) {
        console.error("Keep-alive error:", error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
