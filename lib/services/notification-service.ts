import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
// Removed Role import as it is no longer used

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

    const getUsersWithPermission = async (facilityId: string, permission: string) => {
        return prisma.user.findMany({
            where: {
                facilityId,
                OR: [
                    { permissions: { has: permission } },
                    { roles: { some: { permissions: { has: permission } } } }
                ]
            },
            select: { id: true }
        });
    };

    switch (newStatus) {
        case ORDER_STATUS.DELIVERING_TO_FACTORY:
            if (!order.factoryId) return;
            // Notify Factory that order is coming
            targetUsers = await getUsersWithPermission(order.factoryId, PERMISSIONS.STATUS_VIEW_PROCESSING);
            title = 'استلام طلب جديد';
            message = `طلب رقم ${order.serialNumber} في الطريق للمصنع.`;
            break;



        case ORDER_STATUS.SHOP_READY:
            if (!order.shopId) return;
            // Notify those who can deliver the order (Shop staff)
            targetUsers = await getUsersWithPermission(order.shopId, PERMISSIONS.STATUS_VIEW_COMPLETED);
            title = 'طلب جاهز للاستلام';
            message = `طلب رقم ${order.serialNumber} جاهز في المصنع للاستلام.`;
            break;

        case ORDER_STATUS.REVIEW:
            if (!order.shopId) return;
            // Notify those who can edit/fix the order
            targetUsers = await getUsersWithPermission(order.shopId, PERMISSIONS.ORDERS_EDIT);
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
