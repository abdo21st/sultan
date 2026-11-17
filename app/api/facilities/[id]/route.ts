import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "../../../../lib/prisma";
import { PERMISSIONS } from "../../../../lib/permissions";
import { getRequestUser } from "@/lib/request-user";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

const preparationSchema = z.object({ preparationMinutes: z.number().int().min(5).max(1440) });

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: facilityId } = await params;
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'ADMIN' && !user.permissions.includes(PERMISSIONS.FACTORY_PREPARATION_MANAGE)) {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }
        if (user.role !== 'ADMIN' && user.facilityId !== facilityId) {
            return NextResponse.json({ error: 'يمكنك تعديل مدة تجهيز مصنعك فقط.' }, { status: 403 });
        }
        const parsed = preparationSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ error: 'أدخل مدة تجهيز بين ٥ و١٤٤٠ دقيقة.' }, { status: 400 });
        const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
        if (!facility || facility.type !== 'FACTORY') return NextResponse.json({ error: 'المصنع غير موجود.' }, { status: 404 });
        const updated = await prisma.$transaction(async tx => {
            const result = await tx.facility.update({ where: { id: facilityId }, data: parsed.data });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: 'FACILITY',
                entityId: facilityId,
                action: 'PREPARATION_TIME_UPDATED',
                before: { preparationMinutes: facility.preparationMinutes },
                after: { preparationMinutes: result.preparationMinutes },
            });
            return result;
        });
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: 'تعذر حفظ مدة التجهيز.' }, { status: 500 });
    }
}

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
