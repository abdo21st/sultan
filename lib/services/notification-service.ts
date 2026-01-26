import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/constants";
import { Role } from "@prisma/client";

interface OrderForNotification {
    id: string;
    serialNumber: number;
    factoryId: string | null;
    shopId: string | null;
}

export async function createStatusChangeNotification(order: OrderForNotification, newStatus: string, rejectionReason?: string) {
    let targetUsers: { id: string }[] = [];
    let title = '';
    let message = '';

    const notifyRoles: Role[] = ["MANAGER", "ADMIN"]; // Narrowing roles for notifications

    switch (newStatus) {
        case ORDER_STATUS.TRANSFERRED_TO_FACTORY:
            if (!order.factoryId) return;
            targetUsers = await prisma.user.findMany({
                where: {
                    facilityId: order.factoryId,
                    role: { in: notifyRoles }
                },
                select: { id: true }
            });
            title = 'طلب وارد جديد';
            message = `طلب رقم ${order.serialNumber} وصل للمصنع للتجهيز.`;
            break;

        case ORDER_STATUS.TRANSFERRED_TO_SHOP:
            if (!order.shopId) return;
            targetUsers = await prisma.user.findMany({
                where: {
                    facilityId: order.shopId,
                    role: { in: notifyRoles }
                },
                select: { id: true }
            });
            title = 'طلب جاهز للاستلام';
            message = `طلب رقم ${order.serialNumber} جاهز في المصنع للاستلام.`;
            break;

        case ORDER_STATUS.REVIEW_NEEDED:
            if (!order.shopId) return;
            targetUsers = await prisma.user.findMany({
                where: {
                    facilityId: order.shopId,
                    role: { in: notifyRoles }
                },
                select: { id: true }
            });
            title = 'مراجعة مطلوبة';
            message = `المصنع طلب مراجعة للطلب رقم ${order.serialNumber}: ${rejectionReason}`;
            break;

        default:
            return; // No notification for other statuses by default
    }

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
}
