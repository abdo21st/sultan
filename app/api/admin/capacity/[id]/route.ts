import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";

const capacityRuleSchema = z.object({
    factoryId: z.string().nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    specificDate: z.string().nullable().optional().refine((value) => !value || !Number.isNaN(Date.parse(value))),
    maxCapacity: z.number().int().min(1).max(10000),
}).refine((value) => Boolean(value.specificDate) !== (value.dayOfWeek !== null && value.dayOfWeek !== undefined), {
    message: "Choose a weekday or a specific date.",
});

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح بالتعديل.' }, { status: 403 });
        }

        const parsed = capacityRuleSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid capacity rule." }, { status: 400 });
        const body = parsed.data;
        const updated = await prisma.$transaction(async (tx) => {
            const before = await tx.capacityRule.findUnique({ where: { id } });
            if (!before) throw new Error("CAPACITY_RULE_NOT_FOUND");
            const result = await tx.capacityRule.update({
                where: { id },
                data: {
                    factoryId: body.factoryId || null,
                    dayOfWeek: body.dayOfWeek ?? null,
                    specificDate: body.specificDate ? new Date(body.specificDate) : null,
                    maxCapacity: body.maxCapacity,
                },
            });
            await writeAudit(tx, { actorId: user.id, entityType: "CAPACITY_RULE", entityId: id, action: "UPDATED", before, after: result });
            return result;
        });

        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof Error && error.message === "CAPACITY_RULE_NOT_FOUND") return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        return NextResponse.json({ error: 'Failed to update capacity rule' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await getRequestUser();
        if (!user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح بالحذف.' }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            const before = await tx.capacityRule.findUnique({ where: { id } });
            if (!before) throw new Error("CAPACITY_RULE_NOT_FOUND");
            await tx.capacityRule.delete({ where: { id } });
            await writeAudit(tx, { actorId: user.id, entityType: "CAPACITY_RULE", entityId: id, action: "DELETED", before });
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Error && error.message === "CAPACITY_RULE_NOT_FOUND") return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        return NextResponse.json({ error: 'Failed to delete capacity rule' }, { status: 500 });
    }
}
