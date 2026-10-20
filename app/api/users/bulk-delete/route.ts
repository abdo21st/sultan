import { NextResponse } from 'next/server';
import { prisma } from "../../../../lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";
import { DESTRUCTIVE_CONFIRMATIONS } from "@/lib/constants";

export async function POST(request: Request) {
    try {
        const user = await getRequestUser();

        // Check authentication and admin permission
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }
        const body = await request.json().catch(() => null);
        if (body?.confirmation !== DESTRUCTIVE_CONFIRMATIONS.BULK_DELETE_USERS) {
            return NextResponse.json({ error: 'يتطلب حذف المستخدمين تأكيدًا صريحًا' }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const count = await tx.user.count({ where: { id: { not: user.id } } });
            const deleted = await tx.user.deleteMany({ where: { id: { not: user.id } } });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "USER",
                entityId: "bulk-delete",
                action: "BULK_DELETED",
                before: { count },
                after: { count: deleted.count },
            });
            return deleted;
        });

        return NextResponse.json({
            message: `تم حذف ${result.count} مستخدم بنجاح`,
            count: result.count
        });
    } catch (error) {
        console.error('Error deleting users:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء حذف المستخدمين' },
            { status: 500 }
        );
    }
}
