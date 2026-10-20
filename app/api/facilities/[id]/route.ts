import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "../../../../lib/prisma";
import { PERMISSIONS } from "../../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: facilityId } = await params;
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Check authentication and permission
        if (!user.permissions.includes(PERMISSIONS.FACILITIES_DELETE)) {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }


        // Check if facility has associated orders
        const ordersCount = await prisma.order.count({
            where: {
                OR: [
                    { factoryId: facilityId },
                    { shopId: facilityId }
                ]
            }
        });

        if (ordersCount > 0) {
            return NextResponse.json(
                { error: `لا يمكن حذف المنشأة. يوجد ${ordersCount} طلب مرتبط بها` },
                { status: 400 }
            );
        }

        // Check if facility has associated users
        const usersCount = await prisma.user.count({
            where: { facilityId }
        });

        if (usersCount > 0) {
            return NextResponse.json(
                { error: `لا يمكن حذف المنشأة. يوجد ${usersCount} مستخدم مرتبط بها` },
                { status: 400 }
            );
        }

        // Delete the facility
        await prisma.$transaction(async (tx) => {
            const facility = await tx.facility.findUnique({ where: { id: facilityId } });
            if (!facility) throw new Error('FACILITY_NOT_FOUND');
            await tx.facility.delete({ where: { id: facilityId } });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "FACILITY",
                entityId: facilityId,
                action: "DELETED",
                before: { name: facility.name, type: facility.type, location: facility.location },
            });
        });

        return NextResponse.json({ message: 'تم حذف المنشأة بنجاح' });
    } catch {
        return NextResponse.json(
            { error: 'حدث خطأ أثناء حذف المنشأة' },
            { status: 500 }
        );
    }
}
