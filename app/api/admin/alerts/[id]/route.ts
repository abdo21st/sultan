import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "../../../../../lib/prisma";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (session.user.role !== 'ADMIN') {
            console.warn(`Unauthorized alerts update attempt by ${session.user.username} (Role: ${session.user.role})`);
            return NextResponse.json({ error: `غير مصرح. دورك الحالي (${session.user.role}) لا يسمح بالتعديل.` }, { status: 403 });
        }

        const body = await req.json();
        const { id } = await params;

        const updated = await prisma.alertSetting.update({
            where: { id },
            data: {
                name: body.name,
                triggerStatus: body.triggerStatus,
                timingDays: body.timingDays || 0,
                whatsappEnabled: body.whatsappEnabled || false,
                recipientPhones: body.recipientPhones || [],
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating alert:", error);
        return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'الرجاء تسجيل الدخول' }, { status: 401 });
        }
        if (session.user.role !== 'ADMIN') {
            console.warn(`Unauthorized alerts delete attempt by ${session.user.username} (Role: ${session.user.role})`);
            return NextResponse.json({ error: `غير مصرح. دورك الحالي (${session.user.role}) لا يسمح بالحذف.` }, { status: 403 });
        }

        const { id } = await params;
        await prisma.alertSetting.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting alert:", error);
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}
