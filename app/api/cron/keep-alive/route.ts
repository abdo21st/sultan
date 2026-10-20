import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeCronRequest } from "@/lib/cron-auth";

export async function GET(request: Request) {
    const auth = authorizeCronRequest(request);
    if (auth === "unconfigured") return NextResponse.json({ error: "Scheduled maintenance is not configured." }, { status: 503 });
    if (auth !== "authorized") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    try {
        await prisma.$queryRaw`SELECT 1`;
        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "Database check failed." }, { status: 503 });
    }
}
