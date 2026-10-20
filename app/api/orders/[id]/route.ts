import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { PERMISSIONS } from "../../../../lib/permissions";
import { saveFile } from "../../../../lib/upload";
import { orderSchema } from "@/lib/schemas";
import { canAccessOrderFacility, canViewOrderStatus, getRequestUser } from "@/lib/request-user";
import { fromCents, toCents, toMoneyNumber } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { cleanupUncommittedBlobUploads, enqueueBlobDeletions, processBlobDeletionQueue } from "@/lib/blob-cleanup";


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
                dueDate: true,
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
                updatedAt: true,
            },
        });
        if (!currentOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (!canAccessOrderFacility(user, currentOrder)) return NextResponse.json({ error: "Order not found" }, { status: 404 });
        if (!canViewOrderStatus(user, currentOrder.status)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        const canEditFinancials = user.role === "ADMIN" || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

        // Prepare data for validation (Status is ignored as per design)
        const dataToValidate = {
            customerName: formData.get("customerName"),
            customerPhone: formData.get("customerPhone"),
            description: formData.get("description"),
            dueDate: formData.get("dueDate"),
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

        if (toCents(body.totalAmount) < toCents(currentOrder.paidAmount)) {
            return NextResponse.json({ error: "Total cannot be less than payments already recorded." }, { status: 400 });
        }
        const facilities = await prisma.facility.findMany({
            where: { id: { in: [body.factoryId, body.shopId] } },
            select: { id: true, type: true },
        });
        if (
            facilities.find((facility) => facility.id === body.factoryId)?.type !== "FACTORY" ||
            facilities.find((facility) => facility.id === body.shopId)?.type !== "SHOP"
        ) {
            return NextResponse.json({ error: "Select a valid factory and shop." }, { status: 400 });
        }
        if (user.role !== "ADMIN" && (!user.facilityId || ![body.factoryId, body.shopId].includes(user.facilityId))) {
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
        if (newImageFiles.length + images.length > 10) {
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
            const updated = await tx.order.updateMany({
                where: { id, updatedAt: currentOrder.updatedAt },
                data: {
                customerName: body.customerName,
                customerPhone: body.customerPhone,
                description: body.description,
                totalAmount: body.totalAmount,
                paidAmount: currentOrder.paidAmount,
                remainingAmount: fromCents(Math.max(0, toCents(body.totalAmount) - toCents(currentOrder.paidAmount))),
                dueDate: new Date(body.dueDate),
                factoryId: body.factoryId || undefined,
                shopId: body.shopId || undefined,
                images: images,
                },
            });
            if (updated.count !== 1) throw new Error("ORDER_UPDATE_CONFLICT");
            const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id } });
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
                    totalAmount: updatedOrder.totalAmount,
                    paidAmount: updatedOrder.paidAmount,
                    remainingAmount: updatedOrder.remainingAmount,
                    factoryId: updatedOrder.factoryId,
                    shopId: updatedOrder.shopId,
                    imageCount: updatedOrder.images.length,
                    removedImageCount: removedImageUrls.length,
                },
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
        if (linkedTransactions > 0) {
            return NextResponse.json({ error: "Orders with financial history cannot be deleted." }, { status: 409 });
        }
        const cleanupQueue = await prisma.$transaction(async (tx) => {
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
    } catch {
        return NextResponse.json(
            { error: "Failed to delete order" },
            { status: 500 }
        );
    }
}
