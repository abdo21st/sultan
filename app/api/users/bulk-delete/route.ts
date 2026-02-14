import { NextResponse } from 'next/server';
import { prisma } from "../../../../lib/prisma";
import { auth } from "@/lib/auth";

export async function POST() {
    try {
        const session = await auth();

        // Check authentication and admin permission
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }

        const currentUserId = session.user.id;

        // Delete all users except the current admin
        const result = await prisma.user.deleteMany({
            where: {
                id: {
                    not: currentUserId
                }
            }
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
