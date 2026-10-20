import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
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

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح بالتعديل.' }, { status: 403 });
        }

        const { id } = await params;
        const parsed = alertSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid alert setting." }, { status: 400 });
        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.alertSetting.findUnique({ where: { id } });
            if (!before) throw new Error("ALERT_SETTING_NOT_FOUND");
            const result = await tx.alertSetting.update({ where: { id }, data: parsed.data });
            await writeAudit(tx, { actorId: user.id, entityType: "ALERT_SETTING", entityId: id, action: "UPDATED", before, after: result });
            return result;
        });

        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof Error && error.message === "ALERT_SETTING_NOT_FOUND") return NextResponse.json({ error: "Alert setting not found." }, { status: 404 });
        return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح بالحذف.' }, { status: 403 });
        }

        const { id } = await params;
        await prisma.$transaction(async (tx) => {
            const before = await tx.alertSetting.findUnique({ where: { id } });
            if (!before) throw new Error("ALERT_SETTING_NOT_FOUND");
            await tx.alertSetting.delete({ where: { id } });
            await writeAudit(tx, { actorId: user.id, entityType: "ALERT_SETTING", entityId: id, action: "DELETED", before });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === "ALERT_SETTING_NOT_FOUND") return NextResponse.json({ error: "Alert setting not found." }, { status: 404 });
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}
