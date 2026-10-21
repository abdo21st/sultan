import { prisma } from "@/lib/prisma";
import { ORDER_STATUS } from "@/lib/constants";
import { DEFAULT_ROLES, PERMISSIONS } from "@/lib/permissions";
import type { Prisma } from '@prisma/client';
// Removed Role import as it is no longer used

interface OrderForNotification {
    id: string;
    serialNumber: number;
    factoryId: string | null;
    shopId: string | null;
}

export async function createStatusChangeNotification(order: OrderForNotification, newStatus: string, rejectionReason?: string, client: Pick<Prisma.TransactionClient, 'user' | 'notification'> = prisma) {
    let targetUsers: { id: string }[] = [];
    let title = '';
    let message = '';

    const getUsersWithPermission = async (facilityId: string, permission: string) => {
        return client.user.findMany({
            where: {
                facilityId,
                OR: [
                    { role: { in: (Object.keys(DEFAULT_ROLES) as (keyof typeof DEFAULT_ROLES)[]).filter(role => (DEFAULT_ROLES[role] as readonly string[]).includes(permission)) } },
                    { permissions: { has: permission } },
                    { roles: { some: { permissions: { has: permission } } } }
                ]
            },
            select: { id: true }
        });
    };

    switch (newStatus) {
        case ORDER_STATUS.REGISTERED:
        case ORDER_STATUS.DELIVERING_TO_FACTORY:
            if (!order.factoryId) return;
            // Notify Factory that order is coming
            targetUsers = await getUsersWithPermission(order.factoryId, PERMISSIONS.STATUS_VIEW_PROCESSING);
            title = 'طلب مسجّل للمصنع';
            message = `سجّل المحل طلباً جديداً رقم ${order.serialNumber}، بانتظار بدء التجهيز في المصنع.`;
            break;

        case ORDER_STATUS.PROCESSING:
            if (!order.shopId) return;
            targetUsers = await getUsersWithPermission(order.shopId, PERMISSIONS.STATUS_VIEW_PROCESSING);
            title = 'بدأ المصنع تجهيز الطلب';
            message = `بدأ المصنع تجهيز الطلب رقم ${order.serialNumber}.`;
            break;

        case 'CORRECTION_RESOLVED':
            if (!order.factoryId) return;
            targetUsers = await getUsersWithPermission(order.factoryId, PERMISSIONS.STATUS_VIEW_PROCESSING);
            title = 'تم تصحيح بيانات الطلب';
            message = `صحح المحل بيانات الطلب رقم ${order.serialNumber}، ويمكن متابعة تجهيزه.`;
            break;



        case ORDER_STATUS.SHOP_READY:
            if (!order.shopId) return;
            // Notify those who can deliver the order (Shop staff)
            targetUsers = await getUsersWithPermission(order.shopId, PERMISSIONS.STATUS_VIEW_COMPLETED);
            title = 'أنهى المصنع تجهيز الطلب';
            message = `أنهى المصنع تجهيز الطلب رقم ${order.serialNumber}، بانتظار تسليمه للعميل بواسطة المحل.`;
            break;

        case ORDER_STATUS.REVIEW:
            if (!order.shopId) return;
            // Notify those who can edit/fix the order
            targetUsers = await getUsersWithPermission(order.shopId, PERMISSIONS.ORDERS_EDIT);
            title = 'الطلب يحتاج تصحيحاً';
            message = `المصنع طلب مراجعة للطلب رقم ${order.serialNumber}: ${rejectionReason}`;
            break;

        default:
            return; // No notification for other statuses by default
    }

    if (targetUsers.length > 0) {
        await client.notification.createMany({
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
