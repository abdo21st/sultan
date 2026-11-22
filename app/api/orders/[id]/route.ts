import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { PERMISSIONS } from "../../../../lib/permissions";
import { ORDER_STATUS } from '@/lib/constants';
import { saveFile } from "../../../../lib/upload";
import { orderSchema } from "@/lib/schemas";
import { isOversizedOrderContentLength, MAX_NEW_ORDER_IMAGES } from "@/lib/upload-limits";
import { canAccessAllFacilities, canAccessOrderFacility, canViewOrderStatus, getRequestUser } from "@/lib/request-user";
import { fromCents, toCents, toMoneyNumber } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { cleanupUncommittedBlobUploads, enqueueBlobDeletions, processBlobDeletionQueue } from "@/lib/blob-cleanup";
import { createStatusChangeNotification } from '@/lib/services/notification-service';
import { parseBusinessDateTime, hasPreparationConflict, findNearestAvailablePickup } from '@/lib/preparation-schedule';
import { businessDateKey } from '@/lib/business-date';
import { getCapacitySummary } from '@/lib/capacity';
import { createCapacityWarningIfNeeded } from '@/lib/services/capacity-alert';


export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { id } = await params;
        const canViewFinancials = user.role === 'ADMIN' || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

        const order = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                serialNumber: true,
                customerName: true,
                customerPhone: true,
                description: true,
                status: true,
                reviewRequired: true,
                rejectionReason: true,
                dueDate: true,
                pickupAt: true,
                preparationMinutes: true,
                createdAt: true,
                factoryId: true,
                shopId: true,
                images: true,
                // Only include financial fields if authorized
                totalAmount: canViewFinancials,
                paidAmount: canViewFinancials,
                remainingAmount: canViewFinancials,
            }
        });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        if (!canAccessOrderFacility(user, order)) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }
        if (!canViewOrderStatus(user, order.status)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        return NextResponse.json({
            ...order,
            images: order.images.map((_, index) => `/api/orders/${id}/images/${index}`),
            ...(canViewFinancials ? {
                totalAmount: toMoneyNumber(order.totalAmount),
                paidAmount: toMoneyNumber(order.paidAmount),
                remainingAmount: toMoneyNumber(order.remainingAmount),
            } : {}),
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch order" },
            { status: 500 }
        );
    }
}


export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const uploadedImageUrls: string[] = [];
    let orderCommitted = false;
    let cleanupSourceOrderId: string | null = null;
    try {
        if (isOversizedOrderContentLength(request.headers.get('content-length'))) {
            return NextResponse.json({ error: 'حجم الطلب يتجاوز الحد المسموح.' }, { status: 413 });
        }
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.ORDERS_EDIT)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { id } = await params;
        cleanupSourceOrderId = id;
        const formData = await request.formData();
        const currentOrder = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                images: true,
                paidAmount: true,
                remainingAmount: true,
                totalAmount: true,
                factoryId: true,
                shopId: true,
                status: true,
                customerName: true,
                customerPhone: true,
                description: true,
                dueDate: true,
                pickupAt: true,
                preparationMinutes: true,
                updatedAt: true,
                reviewRequired: true,
                rejectionReason: true,
            },
        });
        if (!currentOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (!canAccessOrderFacility(user, currentOrder)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (!canViewOrderStatus(user, currentOrder.status)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        if (await prisma.orderAdjustment.findFirst({ where: { orderId: id, status: { in: ['REQUESTED', 'APPROVED'] } } })) return NextResponse.json({ error: 'توقف التعديل بسبب طلب إلغاء أو مرتجع.' }, { status: 409 });
        const canEditFinancials = user.role === "ADMIN" || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

        // Prepare data for validation (Status is ignored as per design)
        const dataToValidate = {
            customerName: formData.get("customerName"),
            customerPhone: formData.get("customerPhone"),
            description: formData.get("description"),
            dueDate: formData.get("dueDate"),
            pickupAt: formData.get("pickupAt"),
            totalAmount: canEditFinancials ? formData.get("totalAmount") : String(currentOrder.totalAmount),
            paidAmount: String(currentOrder.paidAmount),
            factoryId: formData.get("factoryId"),
            shopId: formData.get("shopId"),
        };

        const result = orderSchema.safeParse(dataToValidate);
        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const pickupAt = parseBusinessDateTime(body.pickupAt);
        if (!pickupAt || businessDateKey(pickupAt) !== body.dueDate.slice(0, 10)) {
            return NextResponse.json({ error: 'يجب تسجيل وقت استلام صحيح في تاريخ الطلب.' }, { status: 400 });
        }

        if (toCents(body.totalAmount) < toCents(currentOrder.paidAmount)) {
            return NextResponse.json({ error: "Total cannot be less than payments already recorded." }, { status: 400 });
        }
        const facilities = await prisma.facility.findMany({
            where: { id: { in: [body.factoryId, body.shopId] } },
            select: { id: true, type: true, preparationMinutes: true, name: true },
        });
        if (
            facilities.find((facility) => facility.id === body.factoryId)?.type !== "FACTORY" ||
            facilities.find((facility) => facility.id === body.shopId)?.type !== "SHOP"
        ) {
            return NextResponse.json({ error: "Select a valid factory and shop." }, { status: 400 });
        }
        const targetFactory = facilities.find((facility) => facility.id === body.factoryId)!;
        if (!canAccessAllFacilities(user) && (!user.facilityId || ![body.factoryId, body.shopId].includes(user.facilityId))) {
            return NextResponse.json({ error: "You can only edit orders for your assigned facility." }, { status: 403 });
        }

        // Handle images
        let images = currentOrder.images;
        const existingImagesValue = formData.get("existingImages");
        if (existingImagesValue !== null) {
            if (typeof existingImagesValue !== "string") {
                return NextResponse.json({ error: "Invalid image list" }, { status: 400 });
            }
            let submittedImages: unknown;
            try {
                submittedImages = JSON.parse(existingImagesValue);
            } catch {
                return NextResponse.json({ error: "Invalid image list" }, { status: 400 });
            }
            if (!Array.isArray(submittedImages) || submittedImages.length > currentOrder.images.length) {
                return NextResponse.json({ error: "Image list contains an unknown file" }, { status: 400 });
            }
            const retainedImages: string[] = [];
            const proxyPrefix = `/api/orders/${encodeURIComponent(id)}/images/`;
            for (const image of submittedImages) {
                if (typeof image !== "string") return NextResponse.json({ error: "Image list contains an unknown file" }, { status: 400 });
                const imageIndex = image.startsWith(proxyPrefix) ? image.slice(proxyPrefix.length) : "";
                const isProxyImage = /^\d+$/.test(imageIndex);
                const existingImage = isProxyImage
                    ? currentOrder.images[Number(imageIndex)]
                    : currentOrder.images.includes(image) ? image : undefined;
                if (!existingImage) return NextResponse.json({ error: "Image list contains an unknown file" }, { status: 400 });
                retainedImages.push(existingImage);
            }
            images = [...new Set(retainedImages)];
        }

        const newImageValues = formData.getAll("newImages");
        if (newImageValues.some((value) => !(value instanceof File))) {
            return NextResponse.json({ error: "Invalid image upload" }, { status: 400 });
        }
        const newImageFiles = newImageValues as File[];
        if (newImageFiles.length > MAX_NEW_ORDER_IMAGES || newImageFiles.length + images.length > 10) {
            return NextResponse.json({ error: "An order can have at most 10 images" }, { status: 400 });
        }
        if (newImageFiles.length > 0) {
            for (const file of newImageFiles) {
                const path = await saveFile(file, "order");
                if (path) {
                    images.push(path);
                    uploadedImageUrls.push(path);
                }
            }
        }

        const removedImageUrls = currentOrder.images.filter((url) => !images.includes(url));

        const updateResult = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
            if (await tx.orderAdjustment.findFirst({ where: { orderId: id, status: { in: ['REQUESTED', 'APPROVED'] } } })) throw new Error('ORDER_UPDATE_CONFLICT');
            const lockFactories = [...new Set([currentOrder.factoryId, body.factoryId])].sort();
            for (const factoryId of lockFactories) {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-booking:${factoryId}`}))`;
            }
            const targetDay = businessDateKey(pickupAt);
            const targetDueDate = new Date(body.dueDate);
            const capacityRules = await tx.capacityRule.findMany({
                where: {
                    OR: [{ factoryId: null }, { factoryId: body.factoryId }],
                    AND: [{ OR: [{ specificDate: targetDueDate }, { AND: [{ specificDate: null }, { dayOfWeek: targetDueDate.getUTCDay() }] }] }],
                },
            });
            const otherOrdersOnDay = await tx.order.count({
                where: { id: { not: id }, factoryId: body.factoryId, dueDate: targetDueDate, status: { notIn: [ORDER_STATUS.CANCELLED, 'CANCELLED'] } },
            });
            const capacity = getCapacitySummary(capacityRules, body.factoryId, targetDay, otherOrdersOnDay);
            if (capacity.full) throw new Error(`ORDER_CAPACITY_CONFLICT:${otherOrdersOnDay}/${capacity.limit}`);
            const factoryBookings = await tx.order.findMany({
                where: {
                    id: { not: id }, factoryId: body.factoryId,
                    status: { notIn: [ORDER_STATUS.CANCELLED, 'CANCELLED'] },
                    pickupAt: { gte: new Date(pickupAt.getTime() - 24 * 60 * 60_000), lte: new Date(pickupAt.getTime() + 24 * 60 * 60_000) },
                },
                select: { pickupAt: true, preparationMinutes: true },
            });
            const bookings = factoryBookings.filter(item => item.pickupAt).map(item => ({ pickupAt: item.pickupAt!, preparationMinutes: item.preparationMinutes }));
            if (hasPreparationConflict(pickupAt, targetFactory.preparationMinutes, bookings)) {
                const nearest = findNearestAvailablePickup(pickupAt, targetFactory.preparationMinutes, bookings, new Date());
                const nearestLabel = nearest?.toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli', weekday: 'long', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' });
                throw new Error(`ORDER_SLOT_CONFLICT:${nearestLabel ?? 'لا يوجد موعد متاح خلال الثلاثين يوماً القادمة.'}`);
            }
            if (pickupAt.getTime() - targetFactory.preparationMinutes * 60_000 < Date.now()) {
                throw new Error('ORDER_PREPARATION_TOO_LATE');
            }
            const updated = await tx.order.updateMany({
                where: { id, updatedAt: currentOrder.updatedAt },
                data: {
                customerName: body.customerName,
                customerPhone: body.customerPhone,
                description: body.description,
                totalAmount: body.totalAmount,
                paidAmount: currentOrder.paidAmount,
                remainingAmount: fromCents(Math.max(0, toCents(body.totalAmount) - toCents(currentOrder.paidAmount))),
                dueDate: targetDueDate,
                pickupAt,
                preparationMinutes: targetFactory.preparationMinutes,
                factoryId: body.factoryId || undefined,
                shopId: body.shopId || undefined,
                images: images,
                ...(currentOrder.reviewRequired ? { reviewRequired: false, rejectionReason: null } : {}),
                },
            });
            if (updated.count !== 1) throw new Error("ORDER_UPDATE_CONFLICT");
            const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id } });
            if (currentOrder.reviewRequired) {
                await writeAudit(tx, { actorId: user.id, entityType: 'ORDER', entityId: id, action: 'CORRECTION_RESOLVED', before: { reviewRequired: true, reason: currentOrder.rejectionReason }, after: { reviewRequired: false, status: updatedOrder.status } });
                await createStatusChangeNotification(updatedOrder, 'CORRECTION_RESOLVED', undefined, tx);
            }
            const cleanupQueue = await enqueueBlobDeletions(tx, removedImageUrls, id);
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "ORDER",
                entityId: id,
                action: "UPDATED",
                before: {
                    customerName: currentOrder.customerName,
                    customerPhone: currentOrder.customerPhone,
                    description: currentOrder.description,
                    dueDate: currentOrder.dueDate,
                    pickupAt: currentOrder.pickupAt,
                    preparationMinutes: currentOrder.preparationMinutes,
                    totalAmount: currentOrder.totalAmount,
                    paidAmount: currentOrder.paidAmount,
                    remainingAmount: currentOrder.remainingAmount,
                    factoryId: currentOrder.factoryId,
                    shopId: currentOrder.shopId,
                    imageCount: currentOrder.images.length,
                },
                after: {
                    customerName: updatedOrder.customerName,
                    customerPhone: updatedOrder.customerPhone,
                    description: updatedOrder.description,
                    dueDate: updatedOrder.dueDate,
                    pickupAt: updatedOrder.pickupAt,
                    preparationMinutes: updatedOrder.preparationMinutes,
                    totalAmount: updatedOrder.totalAmount,
                    paidAmount: updatedOrder.paidAmount,
                    remainingAmount: updatedOrder.remainingAmount,
                    factoryId: updatedOrder.factoryId,
                    shopId: updatedOrder.shopId,
                    imageCount: updatedOrder.images.length,
                    removedImageCount: removedImageUrls.length,
                },
            });
            await createCapacityWarningIfNeeded(tx, {
                factoryId: body.factoryId,
                factoryName: targetFactory.name,
                businessDay: targetDay,
                orderCount: otherOrdersOnDay + 1,
                rules: capacityRules,
            });
            return { order: updatedOrder, cleanupQueue };
        });
        orderCommitted = true;
        if (updateResult.cleanupQueue.ids.length > 0) {
            try {
                await processBlobDeletionQueue({ ids: updateResult.cleanupQueue.ids });
            } catch {
                console.error("Order image cleanup was deferred to the retry queue.");
            }
        }


        const canViewFinancials = user.role === "ADMIN" || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);
        const { totalAmount, paidAmount, remainingAmount, ...publicOrder } = updateResult.order;
        const safeOrder = { ...publicOrder, images: publicOrder.images.map((_, index) => `/api/orders/${id}/images/${index}`) };
        return NextResponse.json(canViewFinancials ? {
            ...safeOrder,
            totalAmount: toMoneyNumber(totalAmount),
            paidAmount: toMoneyNumber(paidAmount),
            remainingAmount: toMoneyNumber(remainingAmount),
        } : safeOrder);
    } catch (error) {
        if (!orderCommitted && uploadedImageUrls.length > 0) {
            try {
                const cleanup = await cleanupUncommittedBlobUploads(uploadedImageUrls, cleanupSourceOrderId);
                if (cleanup.failed > 0 || cleanup.unsupportedCount > 0) {
                    console.error("Uncommitted order image cleanup was deferred.");
                }
            } catch {
                console.error("Uncommitted order image cleanup could not be queued.");
            }
        }
        if (error instanceof Error && error.message === "ORDER_UPDATE_CONFLICT") {
            return NextResponse.json({ error: "تغير الطلب أثناء التعديل؛ أعد تحميله وحاول مجدداً." }, { status: 409 });
        }
        if (error instanceof Error && error.message.startsWith('ORDER_CAPACITY_CONFLICT:')) return NextResponse.json({ error: `سقف المصنع لهذا اليوم لا يسمح بنقل الطلب (${error.message.split(':')[1]} طلباً محجوزاً).` }, { status: 409 });
        if (error instanceof Error && error.message.startsWith('ORDER_SLOT_CONFLICT:')) return NextResponse.json({ error: `وقت الاستلام مشغول بتجهيز طلبية أخرى. أقرب وقت متاح: ${error.message.slice('ORDER_SLOT_CONFLICT:'.length)}.` }, { status: 409 });
        if (error instanceof Error && error.message === 'ORDER_PREPARATION_TOO_LATE') return NextResponse.json({ error: 'لا يتبقى وقت كافٍ لبدء تجهيز الطلب قبل استلام العميل.' }, { status: 409 });
        console.error("Order update error:", error);
        return NextResponse.json(
            { error: "Failed to update order" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.ORDERS_DELETE)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                factoryId: true,
                shopId: true,
                status: true,
                serialNumber: true,
                customerName: true,
                customerPhone: true,
                totalAmount: true,
                paidAmount: true,
                remainingAmount: true,
                images: true,
            },
        });
        if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (!canAccessOrderFacility(user, order)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (!canViewOrderStatus(user, order.status)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        const linkedTransactions = await prisma.transaction.count({ where: { orderId: id } });
        if (linkedTransactions > 0 || await prisma.orderAdjustment.count({ where: { orderId: id } })) {
            return NextResponse.json({ error: 'لا يمكن حذف طلب له سجل مالي أو طلب إلغاء أو مرتجع. يُحفظ السجل للتدقيق.' }, { status: 409 });
        }
        const cleanupQueue = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "Order" WHERE id=${id} FOR UPDATE`;
            if (await tx.orderAdjustment.count({ where: { orderId: id } }) || await tx.transaction.count({ where: { orderId: id } })) throw new Error('ORDER_HAS_HISTORY');
            const queued = await enqueueBlobDeletions(tx, order.images, id);
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "ORDER",
                entityId: id,
                action: "DELETED",
                before: { ...order, imageCount: order.images.length, images: undefined },
            });
            await tx.order.delete({ where: { id } });
            return queued;
        });

        if (cleanupQueue.ids.length > 0) {
            try {
                await processBlobDeletionQueue({ ids: cleanupQueue.ids });
            } catch {
                console.error("Order image cleanup was deferred to the retry queue.");
            }
        }

        return NextResponse.json({ message: "Order deleted successfully" });
    } catch (error) {
        if (error instanceof Error && error.message === 'ORDER_HAS_HISTORY') return NextResponse.json({ error: 'تغير سجل الطلب؛ لا يمكن حذفه.' }, { status: 409 });
        return NextResponse.json(
            { error: "Failed to delete order" },
            { status: 500 }
        );
    }
}
