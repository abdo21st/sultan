import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { ORDER_STATUS, LEGACY_STATUS_MAPPING } from "@/lib/constants";
import { saveFile } from "@/lib/upload";



export async function GET(request: Request) {
    try {
        console.log("[GET /api/orders] Request received");
        const session = await auth();
        console.log("[GET /api/orders] Session:", session?.user?.id);
        if (!session?.user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const factoryId = searchParams.get('factoryId');
        const shopId = searchParams.get('shopId');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const customerName = searchParams.get('customerName');
        const paymentStatus = searchParams.get('paymentStatus'); // 'unpaid'

        const where: Prisma.OrderWhereInput = {};
        if (factoryId) where.factoryId = factoryId;
        if (shopId) where.shopId = shopId;

        // --- Status Permission Logic ---
        const userPermissions = session?.user?.permissions || [];
        const isMaster = (session?.user as { username?: string })?.username === 'master';

        const allowedStatuses: string[] = [];

        // Check which statuses the user is allowed to VIEW
        if (!isMaster) {
            Object.values(ORDER_STATUS).forEach(status => {
                // status example: "orders:status:registered"
                // view permission: "orders:status:view:registered"
                const statusSuffix = status.replace('orders:status:', '');
                const viewPermission = `orders:status:view:${statusSuffix}`;

                if (userPermissions.includes(viewPermission)) {
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

        if (!isMaster) {
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

        if (paymentStatus === 'unpaid') {
            where.remainingAmount = { gt: 0 };
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

        const orders = await prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(orders);
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
    try {
        console.log("[POST /api/orders] Request received");
        const session = await auth();
        console.log("[POST /api/orders] Session user:", session?.user?.id);
        console.log("[POST /api/orders] Permissions:", session?.user?.permissions);

        const permissions = session?.user?.permissions || [];
        if (!permissions.includes(PERMISSIONS.ORDERS_ADD) && !permissions.includes('*')) {
            console.warn("[POST /api/orders] Unauthorized access");
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const formData = await request.formData();
        console.log("[POST /api/orders] FormData received");

        // Convert FormData to object for Zod validation
        const dataToValidate = {
            customerName: formData.get("customerName"),
            customerPhone: formData.get("customerPhone"),
            description: formData.get("description"),
            dueDate: formData.get("dueDate"),
            totalAmount: formData.get("totalAmount"),
            paidAmount: formData.get("paidAmount"),
            factoryId: formData.get("factoryId"),
            shopId: formData.get("shopId") || session?.user?.facilityId,
        };

        const result = orderSchema.safeParse(dataToValidate);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;
        const dueDateObj = new Date(body.dueDate);
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
                    dueDate: dueDateObj
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
        const imageFiles = formData.getAll("images") as File[];
        console.log(`[POST /api/orders] Found ${imageFiles.length} images`);
        const imagePaths: string[] = [];

        if (imageFiles.length > 0) {
            for (const file of imageFiles) {
                console.log(`[POST /api/orders] Processing file: ${file.name}`);
                try {
                    const path = await saveFile(file, "order");
                    if (path) imagePaths.push(path);
                } catch (e) {
                    console.error(`[POST /api/orders] Error saving file ${file.name}:`, e);
                    // Continue or fail? Let's fail for now if it's critical, or just log
                    throw e; // Propagate error to top level catch
                }
            }
        }

        // Create Order and Transaction Atomically
        const order = await prisma.$transaction(async (tx) => {
            const newOrder = await tx.order.create({
                data: {
                    customerName: body.customerName,
                    customerPhone: body.customerPhone,
                    description: body.description,
                    dueDate: dueDateObj,
                    totalAmount: body.totalAmount,
                    paidAmount: body.paidAmount,
                    remainingAmount: body.totalAmount - body.paidAmount,
                    factoryId: body.factoryId,
                    shopId: body.shopId,
                    status: ORDER_STATUS.REGISTERED,
                    images: imagePaths,
                },
            });

            // Create Transaction if paidAmount > 0
            if (body.paidAmount > 0) {
                await tx.transaction.create({
                    data: {
                        type: 'INCOME',
                        amount: body.paidAmount,
                        category: 'SALES',
                        description: `دفعة مقدمة - طلب #${newOrder.serialNumber} - ${body.customerName}`,
                        createdBy: session?.user?.id,
                        orderId: newOrder.id,
                    }
                });
            }

            return newOrder;
        });

        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/490d5893-3539-43ca-b492-240d3ed9fa0c", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: `log_${Date.now()}_order_created`,
                timestamp: Date.now(),
                runId: "pre-fix",
                hypothesisId: "H3",
                location: "app/api/orders/route.ts:POST",
                message: "Order created via POST /api/orders",
                data: {
                    orderId: order.id,
                    status: order.status,
                    createdBy: session?.user?.id ?? null,
                },
            }),
        }).catch(() => { });
        // #endregion agent log

        return NextResponse.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "فشل إنشاء الطلب",
                details: error
            },
            { status: 500 }
        );
    }
}
