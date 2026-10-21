'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ORDER_STATUS, ALLOWED_TRANSITIONS, CLOSED_ORDER_STATUSES, normalizeOrderStatus } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { createStatusChangeNotification } from "@/lib/services/notification-service";
import { canAccessOrderFacility, canViewOrderStatus, getRequestUser, type RequestUser } from "@/lib/request-user";
import { issueOrderShareToken } from "@/lib/order-sharing";
import { toCents, toMoneyNumber } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { persistOrderStatusTransition } from "@/lib/order-status-transition";
import { parseAllowedWhatsAppApiUrl } from "@/lib/whatsapp-security";

const WHATSAPP_SEND_WINDOW_MS = 60_000;
const WHATSAPP_MAX_SENDS_PER_WINDOW = 10;

/**
 * Send WhatsApp notification with document link
 */
async function sendWhatsAppNotification(
    order: { id: string; serialNumber: number; customerName: string; customerPhone: string },
    status: string,
    actor: RequestUser,
) {
    const actorId = actor.id;
    let attemptId: string | null = null;
    try {
        const settings = await prisma.systemSettings.findFirst();

        if (!settings?.whatsappAutoSend || !settings.whatsappApiUrl || !settings.whatsappApiKey) {
            return; // WhatsApp not configured or disabled
        }

        if (status !== ORDER_STATUS.PROCESSING && status !== ORDER_STATUS.SHOP_READY) return;
        const apiUrl = parseAllowedWhatsAppApiUrl(settings.whatsappApiUrl);
        if (!apiUrl) {
            await prisma.auditLog.create({
                data: { actorId, entityType: "ORDER", entityId: order.id, action: "WHATSAPP_SEND_BLOCKED_CONFIGURATION", after: { status, reason: "INVALID_OR_UNALLOWLISTED_HOST" } },
            });
            return;
        }

        const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
        if (!baseUrl) return;
        const shareUrl = new URL(`/orders/share/${order.id}`, baseUrl);
        const token = await issueOrderShareToken(order.id, actor, 'WHATSAPP');
        if (!token) return;
        shareUrl.searchParams.set('token', token);
        const documentUrl = shareUrl.toString();

        let message = '';
        if (status === ORDER_STATUS.PROCESSING) {
            message = `مرحباً ${order.customerName}،\n\nتم تسجيل طلبك رقم #${order.serialNumber} بنجاح وهو الآن قيد التجهيز.\n\nيمكنك الاطلاع على تفاصيل الطلب من خلال الرابط التالي:\n${documentUrl}\n\nشكراً لثقتكم`;
        } else if (status === ORDER_STATUS.SHOP_READY) {
            message = `مرحباً ${order.customerName}،\n\nطلبك رقم #${order.serialNumber} جاهز للتسليم!\n\nيمكنك الاطلاع على تفاصيل الطلب من خلال الرابط التالي:\n${documentUrl}\n\nشكراً لثقتكم`;
        }

        if (!message) return;

        attemptId = await prisma.$transaction(async (tx) => {
            // Serialize sends for one actor so concurrent status changes cannot bypass the rate limit.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(0, hashtext(${actorId}))`;
            const since = new Date(Date.now() - WHATSAPP_SEND_WINDOW_MS);
            const recentAttempts = await tx.auditLog.count({
                where: { actorId, action: "WHATSAPP_SEND_ATTEMPT", createdAt: { gte: since } },
            });
            if (recentAttempts >= WHATSAPP_MAX_SENDS_PER_WINDOW) {
                await writeAudit(tx, {
                    actorId,
                    entityType: "ORDER",
                    entityId: order.id,
                    action: "WHATSAPP_SEND_RATE_LIMITED",
                    after: { status, windowSeconds: WHATSAPP_SEND_WINDOW_MS / 1000 },
                });
                return null;
            }
            return writeAudit(tx, {
                actorId,
                entityType: "ORDER",
                entityId: order.id,
                action: "WHATSAPP_SEND_ATTEMPT",
                after: { status, providerHost: apiUrl.hostname },
            });
        });
        if (!attemptId) return;

        // Bound the outbound request and reject redirect targets to limit SSRF paths.
        const response = await fetch(apiUrl, {
            method: 'POST',
            redirect: 'error',
            signal: AbortSignal.timeout(8000),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.whatsappApiKey}`,
            },
            body: JSON.stringify({
                phone: order.customerPhone,
                message: message,
            }),
        });
        await prisma.auditLog.create({
            data: {
                actorId,
                entityType: "ORDER",
                entityId: order.id,
                action: "WHATSAPP_SEND_RESULT",
                before: { attemptId },
                after: { status: response.ok ? "SENT" : "FAILED", httpStatus: response.status },
            },
        });
    } catch (error) {
        if (attemptId) {
            await prisma.auditLog.create({
                data: {
                    actorId,
                    entityType: "ORDER",
                    entityId: order.id,
                    action: "WHATSAPP_SEND_RESULT",
                    before: { attemptId },
                    after: { status: "FAILED", reason: "NETWORK_OR_PROVIDER_ERROR" },
                },
            }).catch(() => undefined);
        }
        console.warn('WhatsApp notification delivery failed.', {
            orderId: order.id,
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        // Don't throw - we don't want to fail the status update if WhatsApp fails
    }
}

/**
 * Update the status of an order and notify relevant users
 */
export async function updateOrderStatus(id: string, newStatus: string, rejectionReason?: string) {
    try {
        const user = await getRequestUser();
        if (!user) return { success: false, error: 'يجب تسجيل الدخول' };
        const permissions = user.permissions;

        if (newStatus === ORDER_STATUS.COMPLETED) return { success: false, error: 'استخدم إجراء إتمام التسليم لتسجيل التحصيل وملاحظة الرصيد.' };
        if (![ORDER_STATUS.PROCESSING, ORDER_STATUS.SHOP_READY, ORDER_STATUS.REVIEW].includes(newStatus as typeof ORDER_STATUS.PROCESSING)) return { success: false, error: 'اختر إجراء من المراحل الأربع أو طلب تصحيح البيانات' };

        // Permission Checks
        if (newStatus === ORDER_STATUS.PROCESSING && !permissions.includes(PERMISSIONS.STATUS_CHANGE_PROCESSING)) {
            return { success: false, error: 'ليس لديك صلاحية نقل الطلب إلى "قيد التجهيز"' };
        }
        if (newStatus === ORDER_STATUS.SHOP_READY && !permissions.includes(PERMISSIONS.STATUS_CHANGE_SHOP_READY)) {
            return { success: false, error: 'ليس لديك صلاحية إنهاء التجهيز وإشعار المحل' };
        }
        if (newStatus === ORDER_STATUS.REVIEW && !permissions.includes(PERMISSIONS.STATUS_CHANGE_REVIEW)) {
            return { success: false, error: 'ليس لديك صلاحية طلب تصحيح البيانات' };
        }

        // Check if transition is allowed
        const currentOrder = await prisma.order.findUnique({
            where: { id },
            select: { status: true, factoryId: true, shopId: true, reviewRequired: true, rejectionReason: true }
        });

        if (!currentOrder) return { success: false, error: 'الطلب غير موجود' };
        if (!canAccessOrderFacility(user, currentOrder)) return { success: false, error: 'غير مصرح لك بهذا الطلب' };
        if (!canViewOrderStatus(user, currentOrder.status)) return { success: false, error: 'الطلب غير متاح لك' };

        if (newStatus === ORDER_STATUS.REVIEW) {
            const reason = rejectionReason?.trim() ?? '';
            if ([...reason].length < 5 || reason.length > 1000) return { success: false, error: 'اكتب سبب التصحيح من 5 إلى 1000 حرف' };
            if (normalizeOrderStatus(currentOrder.status) === ORDER_STATUS.COMPLETED || CLOSED_ORDER_STATUSES.includes(currentOrder.status)) return { success: false, error: 'لا يمكن طلب تصحيح بعد إغلاق الطلب' };
            const changed = await prisma.$transaction(async tx => {
                await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
                if (await tx.orderAdjustment.findFirst({ where: { orderId: id, status: { in: ['REQUESTED', 'APPROVED'] } } })) return false;
                const result = await tx.order.updateMany({ where: { id, status: currentOrder.status, reviewRequired: false }, data: { reviewRequired: true, rejectionReason: reason } });
                if (result.count !== 1) return false;
                await writeAudit(tx, { actorId: user.id, entityType: 'ORDER', entityId: id, action: 'CORRECTION_REQUESTED', before: { status: currentOrder.status, reviewRequired: false }, after: { status: currentOrder.status, reviewRequired: true, reason } });
                await createStatusChangeNotification(await tx.order.findUniqueOrThrow({ where: { id } }), ORDER_STATUS.REVIEW, reason, tx);
                return true;
            });
            if (!changed) return { success: false, error: 'تغير الطلب أو يوجد طلب مراجعة مفتوح؛ أعد تحميل الصفحة' };
            revalidatePath(`/orders/${id}`); revalidatePath('/');
            return { success: true };
        }
        if (currentOrder.reviewRequired) return { success: false, error: 'يحتاج الطلب تصحيحاً؛ صحح البيانات أولاً مع بقاء مرحلته الحالية' };

        const allowedNextStatuses = ALLOWED_TRANSITIONS[normalizeOrderStatus(currentOrder.status)] || [];
        if (!allowedNextStatuses.includes(newStatus)) {
            return { success: false, error: `لا يمكن نقل الطلب من حالة "${currentOrder.status}" إلى "${newStatus}"` };
        }

        const changed = await prisma.$transaction(async tx => {
            const result = await persistOrderStatusTransition(tx, {
            orderId: id,
            actorId: user.id,
            currentStatus: currentOrder.status,
            newStatus,
            rejectionReason,
            });
            if (result) await createStatusChangeNotification(await tx.order.findUniqueOrThrow({ where: { id } }), newStatus, undefined, tx);
            return result;
        });
        if (!changed) return { success: false, error: 'تغيرت حالة الطلب؛ أعد تحميل الصفحة وحاول مجدداً' };
        const order = await prisma.order.findUniqueOrThrow({ where: { id } });

        // Trigger Notification Service

        // Send WhatsApp notification for specific statuses
        if (newStatus === ORDER_STATUS.PROCESSING || newStatus === ORDER_STATUS.SHOP_READY) {
            if (user.permissions.includes(PERMISSIONS.WHATSAPP_SEND)) {
                await sendWhatsAppNotification(order, newStatus, user);
            } else {
                const settings = await prisma.systemSettings.findUnique({
                    where: { id: "default" },
                    select: { whatsappAutoSend: true },
                });
                if (settings?.whatsappAutoSend) {
                    await prisma.auditLog.create({
                        data: {
                            actorId: user.id,
                            entityType: "ORDER",
                            entityId: id,
                            action: "WHATSAPP_SEND_DENIED",
                            after: { status: newStatus },
                        },
                    });
                }
            }
        }

        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');

        return { success: true };
    } catch (error) {
        console.error("Order Status Update Error:", error);
        return { success: false, error: 'حدث خطأ أثناء تحديث حالة الطلب' };
    }
}

/**
 * Complete an order, record its final payment, and keep its attachments with the record.
 */
export async function completeOrder(id: string, paymentAmount: number, paymentNote?: string) {
    try {
        const user = await getRequestUser();
        if (!user) return { success: false, error: 'يجب تسجيل الدخول' };
        const permissions = user.permissions;

        if (!permissions.includes(PERMISSIONS.STATUS_CHANGE_COMPLETED)) {
            return { success: false, error: 'ليس لديك صلاحية إتمام الطلب' };
        }

        if (!Number.isFinite(paymentAmount) || paymentAmount < 0 || paymentAmount > 999_999_999_999.99 ||
            Math.abs(paymentAmount * 100 - Math.round(paymentAmount * 100)) > 1e-7) {
            return { success: false, error: 'مبلغ التحصيل غير صحيح' };
        }
        const roundedPayment = Math.round((paymentAmount + Number.EPSILON) * 100) / 100;
        if (roundedPayment > 0 && (!permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS) || !permissions.includes(PERMISSIONS.TRANSACTIONS_ADD))) return { success: false, error: 'تسجيل دفعة يحتاج صلاحية مالية والتحصيل؛ يمكنك تأكيد التسليم بمبلغ صفر' };

        const order = await prisma.order.findUnique({
            where: { id },
            select: { serialNumber: true, customerName: true, remainingAmount: true, totalAmount: true, paidAmount: true, status: true, factoryId: true, shopId: true, updatedAt: true, reviewRequired: true }
        });

        if (!order) return { success: false, error: 'الطلب غير موجود' };
        if (!canAccessOrderFacility(user, order)) return { success: false, error: 'غير مصرح لك بهذا الطلب' };
        if (!canViewOrderStatus(user, order.status)) return { success: false, error: 'الطلب غير متاح لك' };
        if (order.status === ORDER_STATUS.COMPLETED) return { success: false, error: 'الطلب مكتمل بالفعل' };
        if (CLOSED_ORDER_STATUSES.includes(order.status)) return { success: false, error: 'الطلب مغلق بإلغاء أو مرتجع' };
        if (normalizeOrderStatus(order.status) !== ORDER_STATUS.SHOP_READY) return { success: false, error: 'يجب أن يكون الطلب جاهزاً قبل تأكيد تسليمه للعميل' };
        if (order.reviewRequired) return { success: false, error: 'صحح بيانات الطلب أولاً قبل تسليمه للعميل' };
        if (toCents(order.remainingAmount) < toCents(roundedPayment)) {
            return { success: false, error: 'مبلغ التحصيل أكبر من المبلغ المتبقي' };
        }

        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
            if (await tx.orderAdjustment.findFirst({ where: { orderId: id, status: { in: ['REQUESTED', 'APPROVED'] } } })) throw new Error('ORDER_ADJUSTMENT_OPEN');
            const updated = await tx.order.updateMany({
                where: {
                    id,
                    status: order.status,
                    updatedAt: order.updatedAt,
                    reviewRequired: false,
                    remainingAmount: { gte: roundedPayment },
                },
                data: {
                    status: ORDER_STATUS.COMPLETED,
                    paymentNote: paymentNote || null,
                    paidAmount: { increment: roundedPayment },
                    remainingAmount: { decrement: roundedPayment },
                },
            });
            if (updated.count !== 1) throw new Error('ORDER_PAYMENT_CONFLICT');
            const updatedOrder = await tx.order.findUniqueOrThrow({
                where: { id },
                select: { paidAmount: true, remainingAmount: true },
            });

            // Create Transaction if paymentAmount > 0
            if (roundedPayment > 0) {
                const transaction = await tx.transaction.create({
                    data: {
                        type: 'INCOME',
                        amount: roundedPayment,
                        category: 'SALES',
                        description: `دفعة نهائية - إتمام طلب #${order.serialNumber} - ${order.customerName}`,
                        createdBy: user.id,
                        facilityId: user.facilityId ?? order.shopId,
                        idempotencyKey: `completion-payment:${id}`,
                        orderId: id,
                        date: new Date(),
                    }
                });
                await writeAudit(tx, {
                    actorId: user.id,
                    entityType: "TRANSACTION",
                    entityId: transaction.id,
                    action: "PAYMENT_RECORDED",
                    after: { orderId: id, amount: roundedPayment, type: "INCOME", category: "SALES" },
                });
            }
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "ORDER",
                entityId: id,
                action: "COMPLETED",
                before: {
                    status: order.status,
                    paidAmount: toCents(updatedOrder.paidAmount) / 100 - roundedPayment,
                    remainingAmount: toCents(updatedOrder.remainingAmount) / 100 + roundedPayment,
                },
                after: {
                    status: ORDER_STATUS.COMPLETED,
                    paidAmount: toMoneyNumber(updatedOrder.paidAmount),
                    remainingAmount: toMoneyNumber(updatedOrder.remainingAmount),
                },
            });
        });

        revalidatePath(`/orders/${id}`);
        revalidatePath('/orders');
        revalidatePath('/transactions');

        return { success: true };
    } catch (error) {
        if (error instanceof Error && error.message === 'ORDER_ADJUSTMENT_OPEN') return { success: false, error: 'توقف التسليم بسبب طلب إلغاء أو مرتجع؛ راجع قرار المدير' };
        console.error("Order Completion Error:", error);
        return { success: false, error: 'حدث خطأ أثناء إتمام الطلب' };
    }
}
