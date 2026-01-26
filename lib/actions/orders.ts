'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ORDER_STATUS } from "@/lib/constants";
import { createStatusChangeNotification } from "@/lib/services/notification-service";

/**
 * Update the status of an order and notify relevant users
 */
export async function updateOrderStatus(id: string, newStatus: string, rejectionReason?: string) {
    try {
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
export async function completeOrder(id: string, paymentNote?: string) {
    try {
        const order = await prisma.order.findUnique({
            where: { id },
            select: { images: true }
        });

        // Clean up media assets from server
        if (order?.images) {
            const fs = await import("fs/promises");
            const path = await import("path");

            for (const imgPath of (order.images as string[])) {
                try {
                    const fullPath = path.join(process.cwd(), "public", imgPath);
                    await fs.unlink(fullPath);
                } catch (err) {
                    console.error(`Failed to delete image: ${imgPath}`, err);
                }
            }
        }

        await prisma.order.update({
            where: { id },
            data: {
                status: ORDER_STATUS.COMPLETED,
                paymentNote: paymentNote || null,
                images: []
            }
        });

        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');

        return { success: true };
    } catch (error) {
        console.error("Order Completion Error:", error);
        return { success: false, error: 'حدث خطأ أثناء إتمام الطلب' };
    }
}
