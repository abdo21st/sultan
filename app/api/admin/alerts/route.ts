import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { canAccessAllFacilities, getRequestUser } from "@/lib/request-user";
import { PERMISSIONS } from '@/lib/permissions';
import { alertSchema } from '@/lib/alert-settings';
import { writeAudit } from "@/lib/audit";

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.ALERTS_MANAGE) || !canAccessAllFacilities(user)) {
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
        if (!user?.permissions.includes(PERMISSIONS.ALERTS_MANAGE) || !canAccessAllFacilities(user)) {
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
