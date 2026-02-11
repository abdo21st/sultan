import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { auth } from "../../../../../auth";
import { PERMISSIONS } from "../../../../../lib/permissions";

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.USERS_DELETE)) {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        await prisma.capacityRule.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete capacity rule' }, { status: 500 });
    }
}
