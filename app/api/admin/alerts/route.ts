import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";

const alertSchema = z.object({
    name: z.string().trim().min(2).max(100),
    triggerStatus: z.string().trim().min(2).max(100),
    timingDays: z.number().int().min(0).max(365),
    whatsappEnabled: z.boolean(),
    recipientPhones: z.array(z.string().regex(/^\d{10,15}$/)).max(100),
});

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user || user.role !== 'ADMIN') {
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
        const user = await getRequestUser();
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const parsed = alertSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid alert setting." }, { status: 400 });
        const data = await prisma.$transaction(async (tx) => {
            const created = await tx.alertSetting.create({ data: parsed.data });
            await writeAudit(tx, { actorId: user.id, entityType: "ALERT_SETTING", entityId: created.id, action: "CREATED", after: created });
            return created;
        });

        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
    }
}
