import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
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

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const rules = await prisma.capacityRule.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(rules);
    } catch {
        return NextResponse.json({ error: 'Failed to fetch/update rules' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getRequestUser();
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const parsed = capacityRuleSchema.safeParse(await req.json());
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid capacity rule." }, { status: 400 });
        const body = parsed.data;
        const rule = await prisma.$transaction(async (tx) => {
            const created = await tx.capacityRule.create({
                data: {
                    factoryId: body.factoryId || null,
                    dayOfWeek: body.dayOfWeek ?? null,
                    specificDate: body.specificDate ? new Date(body.specificDate) : null,
                    maxCapacity: body.maxCapacity,
                },
            });
            await writeAudit(tx, { actorId: user.id, entityType: "CAPACITY_RULE", entityId: created.id, action: "CREATED", after: created });
            return created;
        });

        return NextResponse.json(rule);
    } catch {
        return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
    }
}
