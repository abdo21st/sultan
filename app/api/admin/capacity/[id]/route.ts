import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (session.user.role !== 'ADMIN') {
            console.warn(`Unauthorized capacity update attempt by ${session.user.username} (Role: ${session.user.role})`);
            return NextResponse.json({ error: `غير مصرح. دورك الحالي (${session.user.role}) لا يسمح بالتعديل.` }, { status: 403 });
        }

        const body = await req.json();
        const updated = await prisma.capacityRule.update({
            where: { id },
            data: {
                factoryId: body.factoryId || null,
                dayOfWeek: body.dayOfWeek !== null ? parseInt(body.dayOfWeek) : null,
                specificDate: body.specificDate ? new Date(body.specificDate) : null,
                maxCapacity: body.maxCapacity,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating capacity rule:', error);
        return NextResponse.json({ error: 'Failed to update capacity rule' }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (session.user.role !== 'ADMIN') {
            console.warn(`Unauthorized capacity delete attempt by ${session.user.username} (Role: ${session.user.role})`);
            return NextResponse.json({ error: `غير مصرح. دورك الحالي (${session.user.role}) لا يسمح بالحذف.` }, { status: 403 });
        }

        await prisma.capacityRule.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete capacity rule' }, { status: 500 });
    }
}
