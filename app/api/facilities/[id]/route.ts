import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: facilityId } = await params;
        const session = await auth();

        // Check authentication and admin permission
        if (!session?.user || session.user.role !== 'ADMIN') {
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
        await prisma.facility.delete({
            where: { id: facilityId }
        });

        return NextResponse.json({ message: 'تم حذف المنشأة بنجاح' });
    } catch (error) {
        console.error('Error deleting facility:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء حذف المنشأة' },
            { status: 500 }
        );
    }
}
