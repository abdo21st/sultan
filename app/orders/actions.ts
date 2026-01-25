'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateOrderStatus(id: string, newStatus: string, rejectionReason?: string) {
    try {
        const order = await prisma.order.update({
            where: { id },
            data: {
                status: newStatus,
                rejectionReason: rejectionReason || null,
            }
        });

        // NOTIFICATION LOGIC
        // 1. Fetch relevant users based on new status
        let targetUsers: any[] = [];
        let title = '';
        let message = '';

        if (newStatus === 'TRANSFERRED_TO_FACTORY') {
            targetUsers = await prisma.user.findMany({
                where: {
                    facilityId: order.factoryId,
                    role: { in: ['MANAGER', 'USER', 'ADMIN'] }
                }
            });
            title = 'طلب وارد جديد';
            message = `طلب رقم ${order.serialNumber} وصل للمصنع للتجهيز.`;
        } else if (newStatus === 'TRANSFERRED_TO_SHOP') {
            targetUsers = await prisma.user.findMany({
                where: {
                    facilityId: order.shopId,
                    role: { in: ['MANAGER', 'USER', 'ADMIN'] }
                }
            });
            title = 'طلب جاهز للاستلام';
            message = `طلب رقم ${order.serialNumber} جاهز في المصنع للاستلام.`;
        } else if (newStatus === 'REVIEW_NEEDED') {
            targetUsers = await prisma.user.findMany({
                where: {
                    facilityId: order.shopId,
                    role: { in: ['MANAGER', 'USER', 'ADMIN'] }
                }
            });
            title = 'مراجعة مطلوبة';
            message = `المصنع طلب مراجعة للطلب رقم ${order.serialNumber}: ${rejectionReason}`;
        }

        // 2. Create Notifications
        if (targetUsers.length > 0) {
            await prisma.notification.createMany({
                data: targetUsers.map(u => ({
                    userId: u.id,
                    title,
                    message,
                    link: `/orders/${order.id}`,
                    read: false
                }))
            });
        }

        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');
        return { success: true };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Failed to update status' };
    }
}

export async function completeOrder(id: string, paymentNote?: string) {
    try {
        await prisma.order.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                paymentNote: paymentNote || null
            }
        });
        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Failed to complete order' };
    }
}
