import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const settings = await prisma.alertSetting.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(settings);
    } catch {
        return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const body = await req.json();
        const data = await prisma.alertSetting.create({
            data: {
                name: body.name,
                triggerStatus: body.triggerStatus,
                timingDays: body.timingDays || 0,
                whatsappEnabled: body.whatsappEnabled || false,
                recipientPhones: body.recipientPhones || [],
            }
        });

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }
}
