import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
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
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const body = await req.json();
        const rule = await prisma.capacityRule.create({
            data: {
                factoryId: body.factoryId || null,
                dayOfWeek: body.dayOfWeek !== undefined ? body.dayOfWeek : null,
                specificDate: body.specificDate ? new Date(body.specificDate) : null,
                maxCapacity: body.maxCapacity,
            }
        });

        return NextResponse.json(rule);
    } catch (error) {
        console.error('Error creating capacity rule:', error);
        return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
    }
}
