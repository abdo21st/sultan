import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { ORDER_STATUS, LEGACY_STATUS_MAPPING, CLOSED_ORDER_STATUSES } from "@/lib/constants";
import { saveFile } from "@/lib/upload";
import { canAccessAllFacilities, canAccessOrderFacility, canViewOrderStatus, getRequestUser, orderFacilityFilter } from "@/lib/request-user";
import { z } from "zod";
import { toCents, toMoneyNumber } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { cleanupUncommittedBlobUploads } from "@/lib/blob-cleanup";
import { decodeDateIdCursor, encodeDateIdCursor, parsePageSize } from "@/lib/keyset-pagination";
import { createStatusChangeNotification } from '@/lib/services/notification-service';



export async function GET(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const limit = parsePageSize(searchParams.get('limit'));
        const cursor = decodeDateIdCursor(searchParams.get('cursor'));
        if (!limit || cursor === false) return NextResponse.json({ error: "Invalid pagination parameters." }, { status: 400 });
        const factoryId = searchParams.get('factoryId');
        const shopId = searchParams.get('shopId');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const customerName = searchParams.get('customerName');
        const search = searchParams.get('q')?.trim();
        if (search && search.length > 120) return NextResponse.json({ error: 'نص البحث أطول من الحد المسموح.' }, { status: 400 });
        const paymentStatus = searchParams.get('paymentStatus'); // 'unpaid'
        const deliveryFollowUp = searchParams.get('deliveryFollowUp') === 'true';

        const where: Prisma.OrderWhereInput = {};
        if (searchParams.get('reviewRequired') === 'true') where.reviewRequired = true;
        const facilityScope = orderFacilityFilter(user);
        if (Object.keys(facilityScope).length > 0) where.AND = [facilityScope];
        if (factoryId) where.factoryId = factoryId;
        if (shopId) where.shopId = shopId;

        // --- Status Permission Logic ---
        const userPermissions = user.permissions;
        const isAdmin = user.role === 'ADMIN';

        const allowedStatuses: string[] = [];

        // Check which statuses the user is allowed to VIEW
        if (!isAdmin) {
            Object.values(ORDER_STATUS).forEach(status => {
                // status example: "orders:status:registered"
                // view permission: "orders:status:view:registered"
                if (canViewOrderStatus(user, status)) {
                    allowedStatuses.push(status);
                    // Add Legacy Status if exists
                    const legacy = LEGACY_STATUS_MAPPING[status];
                    if (legacy) allowedStatuses.push(legacy);
                }
            });
        } else {
            // Master allows all from logic below, just ensuring array isn't empty if used differently
        }

        // Hard rule: effective status filter is intersection of (requested status) AND (allowed statuses)
        // If user is master, allowedStatuses effectively includes ALL (skipped check).

        if (!isAdmin) {
            if (status) {
                // User wants specific statuses. Check if they are allowed.
                const requestedStatuses = status.split(',');
                const validStatuses = requestedStatuses.filter(s => allowedStatuses.includes(s));

                if (validStatuses.length === 0) {
                    // User requested statuses they don't have access to -> return empty
                    return NextResponse.json([]);
                }

                // Expand validStatuses to include legacy versions for DB query
                const expandedStatuses = [...validStatuses];
                validStatuses.forEach(s => {
                    const legacy = LEGACY_STATUS_MAPPING[s];
                    if (legacy && !expandedStatuses.includes(legacy)) {
                        expandedStatuses.push(legacy);
                    }
                });

                where.status = { in: expandedStatuses };
            } else {
                // User didn't request specific status -> show ALL allowed statuses
                if (allowedStatuses.length === 0) {
                    // User has NO status permissions -> return empty
                    return NextResponse.json([]);
                }
                where.status = { in: allowedStatuses };
            }
        } else {
            // Master sees what they requested, or everything
            if (status) where.status = { in: status.split(',') };
        }

        if (customerName) where.customerName = { contains: customerName, mode: 'insensitive' };
        if (search) {
            const normalized = search.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776));
            const serial = normalized.replace(/^#/, '');
            const matches: Prisma.OrderWhereInput[] = [
                { customerName: { contains: search, mode: 'insensitive' } },
                { customerPhone: { contains: normalized, mode: 'insensitive' } },
            ];
            if (/^\d+$/.test(serial) && Number(serial) > 0 && Number(serial) <= 2147483647) matches.push({ serialNumber: Number(serial) });
            const scoped = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
            where.AND = [...scoped, { OR: matches }];
        }

        if (paymentStatus === 'unpaid') {
            where.remainingAmount = { gt: 0 };
            where.adjustments = { none: { status: 'REQUESTED' } };
            const scoped = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
            where.AND = [...scoped, { status: { notIn: CLOSED_ORDER_STATUSES } }];
        }

        if (deliveryFollowUp) {
            const scoped = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
            where.AND = [...scoped, { status: { notIn: [ORDER_STATUS.COMPLETED, 'COMPLETED', 'orders:status:cancelled', 'CANCELLED', 'orders:status:returned', 'RETURNED'] } }];
            where.adjustments = { none: { status: 'REQUESTED' } };
        }

        if (startDate || endDate) {
            where.dueDate = {};
            if (startDate) where.dueDate.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.dueDate.lte = end;
            }
        }

        if (cursor) {
            const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
            where.AND = [...existingAnd, {
                OR: [
                    { createdAt: { lt: cursor.date } },
                    { createdAt: cursor.date, id: { lt: cursor.id } },
                ],
            }];
        }

        const canViewFinancials = isAdmin || userPermissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

        const orders = await prisma.order.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            select: {
                id: true,
                serialNumber: true,
                customerName: true,
                customerPhone: true,
                description: true,
                status: true,
                dueDate: true,
                reviewRequired: true,
                rejectionReason: true,
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
        const hasMore = orders.length > limit;
        const page = hasMore ? orders.slice(0, limit) : orders;
        const nextCursor = hasMore && page.length > 0
            ? encodeDateIdCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
            : null;
        return NextResponse.json(page.map((order) => canViewFinancials ? {
            ...order,
            images: order.images.map((_, index) => `/api/orders/${order.id}/images/${index}`),
            totalAmount: toMoneyNumber(order.totalAmount),
            paidAmount: toMoneyNumber(order.paidAmount),
            remainingAmount: toMoneyNumber(order.remainingAmount),
        } : { ...order, images: order.images.map((_, index) => `/api/orders/${order.id}/images/${index}`) }), {
            headers: nextCursor ? { 'X-Next-Cursor': nextCursor } : undefined,
        });
    } catch (error) {
        console.error("Fetch orders error:", error);
        return NextResponse.json(
            { error: "Failed to fetch orders" },
            { status: 500 }
        );
    }
}

import { orderSchema } from "@/lib/schemas";


export async function POST(request: Request) {
    let clientRequestId: string | null = null;
    let expectedOrderData: {
        customerName: string;
        customerPhone: string;
        description: string;
        dueDate: Date;
        totalAmount: number;
        paidAmount: number;
        factoryId: string;
        shopId: string;
    } | null = null;
    const uploadedImageUrls: string[] = [];
    let orderCommitted = false;
    try {
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const permissions = user.permissions;
        if (!permissions.includes(PERMISSIONS.ORDERS_ADD) && !permissions.includes('*')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const formData = await request.formData();

        // Convert FormData to object for Zod validation
        const dataToValidate = {
            customerName: formData.get("customerName"),
            customerPhone: formData.get("customerPhone"),
            description: formData.get("description"),
            dueDate: formData.get("dueDate"),
            totalAmount: formData.get("totalAmount"),
            paidAmount: formData.get("paidAmount"),
            factoryId: formData.get("factoryId"),
            shopId: formData.get("shopId") || (user.role !== "ADMIN" ? user.facilityId : undefined),
        };

        const result = orderSchema.safeParse(dataToValidate);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const totalAmount = Math.round((body.totalAmount + Number.EPSILON) * 100) / 100;
        const paidAmount = Math.round((body.paidAmount + Number.EPSILON) * 100) / 100;
        const dueDateObj = new Date(body.dueDate);
        expectedOrderData = {
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            description: body.description,
            dueDate: dueDateObj,
            totalAmount,
            paidAmount,
            factoryId: body.factoryId,
            shopId: body.shopId,
        };
        if (paidAmount > 0 && user.role !== "ADMIN" && (
            !permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS) ||
            !permissions.includes(PERMISSIONS.TRANSACTIONS_ADD)
        )) {
            return NextResponse.json({ error: "You are not allowed to register an initial payment." }, { status: 403 });
        }

        const requestIdResult = z.string().uuid().safeParse(formData.get("clientRequestId"));
        if (!requestIdResult.success) {
            return NextResponse.json({ error: "A valid request identifier is required." }, { status: 400 });
        }
        clientRequestId = requestIdResult.data;
        const facilities = await prisma.facility.findMany({
            where: { id: { in: [body.factoryId, body.shopId] } },
            select: { id: true, type: true },
        });
        const factory = facilities.find((facility) => facility.id === body.factoryId);
        const shop = facilities.find((facility) => facility.id === body.shopId);
        if (factory?.type !== "FACTORY" || shop?.type !== "SHOP") {
            return NextResponse.json({ error: "Select a valid factory and shop." }, { status: 400 });
        }
        if (!canAccessAllFacilities(user) && (!user.facilityId || ![body.factoryId, body.shopId].includes(user.facilityId))) {
            return NextResponse.json({ error: "You can only create orders for your assigned facility." }, { status: 403 });
        }
        const existingOrder = await prisma.order.findUnique({ where: { clientRequestId } });
        if (existingOrder) {
            if (!expectedOrderData || !sameOrderRequest(existingOrder, expectedOrderData)) {
                return NextResponse.json({ error: "Request identifier reused for different order data." }, { status: 409 });
            }
            if (!canAccessOrderFacility(user, existingOrder) || !canViewOrderStatus(user, existingOrder.status)) {
                return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }
            return NextResponse.json(orderResponse(existingOrder, user));
        }
        const dayOfWeek = dueDateObj.getDay();

        // Capacity Check
        const capacityRules = await prisma.capacityRule.findMany({
            where: {
                OR: [
                    { factoryId: null },
                    { factoryId: body.factoryId }
                ],
                AND: [
                    {
                        OR: [
                            { specificDate: dueDateObj },
                            { AND: [{ specificDate: null }, { dayOfWeek: dayOfWeek }] }
                        ]
                    }
                ]
            }
        });

        if (capacityRules.length > 0) {
            const minCapacity = Math.min(...capacityRules.map((r: { maxCapacity: number }) => r.maxCapacity));
            const currentOrdersCount = await prisma.order.count({
                where: {
                    factoryId: body.factoryId,
                    dueDate: dueDateObj,
                    status: { notIn: [ORDER_STATUS.CANCELLED, 'CANCELLED'] },
                }
            });

            if (currentOrdersCount >= minCapacity) {
                return NextResponse.json(
                    { error: `عذراً، تم الوصول للحد الأقصى من الطلبات لهذا اليوم (${minCapacity} طلبات). يرجى اختيار تاريخ آخر.` },
                    { status: 400 }
                );
            }
        }

        // Handle Images
        const imageValues = formData.getAll("images");
        if (imageValues.length > 10 || imageValues.some((value) => !(value instanceof File))) {
            return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
        }
        const imageFiles = imageValues as File[];
        const imagePaths: string[] = [];

        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                try {
                    const path = await saveFile(file, "order");
                    if (path) {
                        imagePaths.push(path);
                        uploadedImageUrls.push(path);
                    }
                } catch (e) {
                    throw e; // Propagate error to top level catch
                }
            }
        }

        // Create Order and Transaction Atomically
        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    clientRequestId,
                    customerName: body.customerName,
                    customerPhone: body.customerPhone,
                    description: body.description,
                    dueDate: dueDateObj,
                    totalAmount,
                    paidAmount,
                    remainingAmount: totalAmount - paidAmount,
                    factoryId: body.factoryId,
                    shopId: body.shopId,
                    status: ORDER_STATUS.REGISTERED,
                    images: imagePaths,
                },
            });

            // Create Transaction if paidAmount > 0
            if (paidAmount > 0) {
                await tx.transaction.create({
                    data: {
                        type: 'INCOME',
                        amount: paidAmount,
                        category: 'SALES',
                        description: `دفعة مقدمة - طلب #${newOrder.serialNumber} - ${body.customerName}`,
                        createdBy: user.id,
                        facilityId: body.shopId,
                        idempotencyKey: `initial-payment:${newOrder.id}`,
                        orderId: newOrder.id,
                    }
                });
            }

            await writeAudit(tx, {
                actorId: user.id,
                entityType: "ORDER",
                entityId: newOrder.id,
                action: "CREATED",
                after: {
                    serialNumber: newOrder.serialNumber,
                    customerName: newOrder.customerName,
                    customerPhone: newOrder.customerPhone,
                    status: newOrder.status,
                    totalAmount,
                    paidAmount,
                    remainingAmount: totalAmount - paidAmount,
                    factoryId: newOrder.factoryId,
                    shopId: newOrder.shopId,
                },
            });

            await createStatusChangeNotification(newOrder, ORDER_STATUS.REGISTERED, undefined, tx);
            return newOrder;
        });
        orderCommitted = true;

        return NextResponse.json(orderResponse(order, user));
    } catch (error) {
        if (!orderCommitted && uploadedImageUrls.length > 0) {
            try {
                const cleanup = await cleanupUncommittedBlobUploads(uploadedImageUrls);
                if (cleanup.failed > 0 || cleanup.unsupportedCount > 0) {
                    console.error("Uncommitted order image cleanup was deferred.");
                }
            } catch {
                console.error("Uncommitted order image cleanup could not be queued.");
            }
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            if (clientRequestId) {
                const existingOrder = await prisma.order.findUnique({ where: { clientRequestId } });
                if (existingOrder) {
                    const user = await getRequestUser();
                    if (user && expectedOrderData && sameOrderRequest(existingOrder, expectedOrderData) &&
                        canAccessOrderFacility(user, existingOrder) && canViewOrderStatus(user, existingOrder.status)) {
                        return NextResponse.json(orderResponse(existingOrder, user));
                    }
                }
            }
        }
        console.error("Error creating order:", error);
        return NextResponse.json(
            { error: "فشل إنشاء الطلب" },
            { status: 500 }
        );
    }
}

function sameOrderRequest(
    order: {
        customerName: string;
        customerPhone: string;
        description: string;
        dueDate: Date;
        totalAmount: Prisma.Decimal | number;
        paidAmount: Prisma.Decimal | number;
        factoryId: string;
        shopId: string;
    },
    expected: {
        customerName: string;
        customerPhone: string;
        description: string;
        dueDate: Date;
        totalAmount: number;
        paidAmount: number;
        factoryId: string;
        shopId: string;
    },
) {
    return order.customerName === expected.customerName &&
        order.customerPhone === expected.customerPhone &&
        order.description === expected.description &&
        order.factoryId === expected.factoryId &&
        order.shopId === expected.shopId &&
        order.dueDate.getTime() === expected.dueDate.getTime() &&
        toCents(order.totalAmount) === toCents(expected.totalAmount) &&
        toCents(order.paidAmount) === toCents(expected.paidAmount);
}

function orderResponse<T extends { id: string; images: string[]; totalAmount: Prisma.Decimal | number; paidAmount: Prisma.Decimal | number; remainingAmount: Prisma.Decimal | number }>(order: T, user: { role: string; permissions: string[] }) {
    const { totalAmount, paidAmount, remainingAmount, ...orderFields } = order;
    const publicOrder = { ...orderFields, images: order.images.map((_, index) => `/api/orders/${order.id}/images/${index}`) };
    if (user.role === "ADMIN" || user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) {
        return {
            ...publicOrder,
            totalAmount: toMoneyNumber(totalAmount),
            paidAmount: toMoneyNumber(paidAmount),
            remainingAmount: toMoneyNumber(remainingAmount),
        };
    }
    return publicOrder;
}
