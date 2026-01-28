import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
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
        if (status) where.status = { in: status.split(',') };
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

import { z } from "zod";

const orderSchema = z.object({
    customerName: z.string().min(2, "اسم العميل يجب أن يكون حرفين على الأقل"),
    customerPhone: z.string().regex(/^\d{8,15}$/, "رقم الهاتف غير صحيح"),
    description: z.string().min(5, "الوصف يجب أن يكون 5 أحرف على الأقل"),
    dueDate: z.string().refine((val: string) => !isNaN(Date.parse(val)), {
        message: "تاريخ الاستحقاق غير صحيح",
    }),
    totalAmount: z.preprocess((val) => parseFloat(val as string), z.number().positive("الإجمالي يجب أن يكون قيمة موجبة")),
    paidAmount: z.preprocess((val) => parseFloat((val as string) || "0"), z.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً")),
    factoryId: z.string().min(1, "يجب اختيار المصنع"),
    shopId: z.string().min(1, "يجب اختيار المعرض"),
});

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
                    status: "REGISTERED",
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

        return NextResponse.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        return NextResponse.json(
            { error: "فشل إنشاء الطلب" },
            { status: 500 }
        );
    }
}
