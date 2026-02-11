'use server';

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ORDER_STATUS, ALLOWED_TRANSITIONS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { createStatusChangeNotification } from "@/lib/services/notification-service";

/**
 * Update the status of an order and notify relevant users
 */
export async function updateOrderStatus(id: string, newStatus: string, rejectionReason?: string) {
    try {
        const session = await auth();
        const permissions = session?.user?.permissions || [];

        // Permission Checks
        if (newStatus === ORDER_STATUS.PROCESSING && !permissions.includes(PERMISSIONS.STATUS_CHANGE_PROCESSING)) {
            return { success: false, error: 'ليس لديك صلاحية نقل الطلب إلى "قيد التجهيز"' };
        }
        if (newStatus === ORDER_STATUS.DELIVERING_TO_FACTORY && !permissions.includes(PERMISSIONS.STATUS_CHANGE_DELIVERING_TO_FACTORY)) {
            return { success: false, error: 'ليس لديك صلاحية بدء توصيل الطلب للمصنع' };
        }
        if (newStatus === ORDER_STATUS.SHOP_READY && !permissions.includes(PERMISSIONS.STATUS_CHANGE_SHOP_READY)) {
            return { success: false, error: 'ليس لديك صلاحية نقل الطلب إلى "جاهز للمحل"' };
        }
        if (newStatus === ORDER_STATUS.DELIVERING && !permissions.includes(PERMISSIONS.STATUS_CHANGE_DELIVERING)) {
            return { success: false, error: 'ليس لديك صلاحية نقل الطلب إلى "قيد التوصيل"' };
        }
        if (newStatus === ORDER_STATUS.REVIEW && !permissions.includes(PERMISSIONS.STATUS_CHANGE_REVIEW)) {
            return { success: false, error: 'ليس لديك صلاحية إعادة الطلب للمراجعة' };
        }
        if (newStatus === ORDER_STATUS.REGISTERED && !permissions.includes(PERMISSIONS.STATUS_CHANGE_REGISTERED)) {
            return { success: false, error: 'ليس لديك صلاحية إعادة الطلب إلى "قيد التسجيل"' };
        }
        if (newStatus === ORDER_STATUS.COMPLETED && !permissions.includes(PERMISSIONS.STATUS_CHANGE_COMPLETED)) {
            // Although completeOrder should be used, we guard this path too
            return { success: false, error: 'ليس لديك صلاحية إتمام الطلب' };
        }

        // Check if transition is allowed
        const currentStatus = await prisma.order.findUnique({
            where: { id },
            select: { status: true }
        });

        if (!currentStatus) return { success: false, error: 'الطلب غير موجود' };

        const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus.status] || [];
        if (!allowedNextStatuses.includes(newStatus)) {
            return { success: false, error: `لا يمكن نقل الطلب من حالة "${currentStatus.status}" إلى "${newStatus}"` };
        }

        const order = await prisma.order.update({
            where: { id },
            data: {
                status: newStatus,
                rejectionReason: rejectionReason || null,
            }
        });

        // Trigger Notification Service
        await createStatusChangeNotification(order, newStatus, rejectionReason);

        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');

        return { success: true };
    } catch (error) {
        console.error("Order Status Update Error:", error);
        return { success: false, error: 'حدث خطأ أثناء تحديث حالة الطلب' };
    }
}

/**
 * Complete an order: delete images and update status
 */
/**
 * Complete an order: delete images, update status, and record payment
 */
export async function completeOrder(id: string, paymentAmount: number, paymentNote?: string) {
    try {
        const session = await auth();
        const userId = session?.user?.id;
        const permissions = session?.user?.permissions || [];

        if (!permissions.includes(PERMISSIONS.STATUS_CHANGE_COMPLETED)) {
            return { success: false, error: 'ليس لديك صلاحية إتمام الطلب' };
        }

        const order = await prisma.order.findUnique({
            where: { id },
            select: { images: true, serialNumber: true, customerName: true, remainingAmount: true, totalAmount: true, paidAmount: true }
        });

        if (!order) return { success: false, error: 'الطلب غير موجود' };

        // Clean up media assets from server
        if (order.images && Array.isArray(order.images)) {
            const fs = await import("fs/promises");
            const path = await import("path");

            for (const imgPath of order.images) {
                try {
                    const fullPath = path.join(process.cwd(), "public", imgPath);
                    await fs.unlink(fullPath).catch(() => { }); // Ignore unlink errors
                } catch (err) {
                    console.error(`Failed to delete image: ${imgPath}`, err);
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // Create Transaction if paymentAmount > 0
            if (paymentAmount > 0) {
                await tx.transaction.create({
                    data: {
                        type: 'INCOME',
                        amount: paymentAmount,
                        category: 'SALES',
                        description: `دفعة نهائية - إتمام طلب #${order.serialNumber} - ${order.customerName}`,
                        createdBy: userId,
                        orderId: id,
                        date: new Date(),
                    }
                });
            }

            const newPaidAmount = (order.paidAmount || 0) + paymentAmount;
            const newRemaining = (order.totalAmount || 0) - newPaidAmount;

            await tx.order.update({
                where: { id },
                data: {
                    status: ORDER_STATUS.COMPLETED,
                    paymentNote: paymentNote || null,
                    paidAmount: newPaidAmount,
                    remainingAmount: newRemaining,
                    images: []
                }
            });
        });

        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');
        revalidatePath('/transactions');

        return { success: true };
    } catch (error) {
        console.error("Order Completion Error:", error);
        return { success: false, error: 'حدث خطأ أثناء إتمام الطلب' };
    }
}
