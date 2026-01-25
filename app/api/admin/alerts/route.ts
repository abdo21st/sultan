import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";

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
    } catch (error) {
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
        const setting = await prisma.alertSetting.create({
            data: {
                name: body.name,
                triggerStatus: body.triggerStatus,
                timingDays: body.timingDays || 0,
                whatsappEnabled: body.whatsappEnabled || false,
                recipientPhones: body.recipientPhones || [],
            }
        });

        return NextResponse.json(setting);
    } catch (error) {
        return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
    }
}
