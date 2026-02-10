import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { prisma } from "../../../../../lib/prisma";

export async function PUT(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const body = await req.json();
        const { id } = params;

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
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const { id } = params;
        await prisma.alertSetting.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting alert:", error);
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}
