import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const factoryId = searchParams.get('factoryId');
        const shopId = searchParams.get('shopId');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const customerName = searchParams.get('customerName');

        const where: Prisma.OrderWhereInput = {};
        if (factoryId) where.factoryId = factoryId;
        if (shopId) where.shopId = shopId;
        if (status) where.status = { in: status.split(',') };
        if (customerName) where.customerName = { contains: customerName, mode: 'insensitive' };

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

export async function POST(request: Request) {
    try {
        const session = await auth();
        const formData = await request.formData();

        const customerName = formData.get("customerName") as string;
        const customerPhone = formData.get("customerPhone") as string;
        const description = formData.get("description") as string;
        const dueDate = formData.get("dueDate") as string;
        const totalAmount = parseFloat(formData.get("totalAmount") as string);
        const paidAmount = parseFloat((formData.get("paidAmount") as string) || "0");
        const remainingAmount = totalAmount - paidAmount;
        const factoryId = formData.get("factoryId") as string;
        const dueDateObj = new Date(dueDate);
        const dayOfWeek = dueDateObj.getDay();

        // Capacity Check
        const capacityRules = await prisma.capacityRule.findMany({
            where: {
                OR: [
                    { factoryId: null },
                    { factoryId: factoryId }
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
            // Find most specific rule (factory + specific date > factory only > general specific date > general day)
            // For simplicity, we'll take the minimum capacity among applicable rules
            const minCapacity = Math.min(...capacityRules.map(r => r.maxCapacity));

            const currentOrdersCount = await prisma.order.count({
                where: {
                    factoryId: factoryId,
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

        // Trust shopId from form (which might be auto-filled for restricted users) or fallback to session
        let shopId = formData.get("shopId") as string;
        if (!shopId && session?.user?.facilityId) {
            shopId = session.user.facilityId;
        }

        // Handle Images
        const imageFiles = formData.getAll("images") as File[];
        const imagePaths: string[] = [];

        if (imageFiles.length > 0) {
            const uploadDir = path.join(process.cwd(), "public", "uploads");
            await mkdir(uploadDir, { recursive: true });

            for (const file of imageFiles) {
                if (file.size > 0) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const filename = `${Date.now()}-${file.name.replace(/\s/g, "_")}`;
                    await writeFile(path.join(uploadDir, filename), buffer);
                    imagePaths.push(`/uploads/${filename}`);
                }
            }
        }

        // Create Order
        const order = await prisma.order.create({
            data: {
                customerName,
                customerPhone,
                description,
                dueDate: dueDateObj,
                totalAmount,
                paidAmount,
                remainingAmount,
                factoryId,
                shopId,
                status: "REGISTERED", // Start as Registered
                images: imagePaths,
            },
        });

        // Create Transaction if paidAmount > 0
        if (paidAmount > 0) {
            await prisma.transaction.create({
                data: {
                    type: 'INCOME',
                    amount: paidAmount,
                    category: 'SALES',
                    description: `دفعة مقدمة - طلب #${order.serialNumber} - ${customerName}`,
                    createdBy: session?.user?.id,
                }
            });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        return NextResponse.json(
            { error: "Failed to create order" },
            { status: 500 }
        );
    }
}
