import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
        });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch {
        return NextResponse.json(
            { error: "Failed to fetch order" },
            { status: 500 }
        );
    }
}

import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.ORDERS_EDIT)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { id } = await params;
        const formData = await request.formData();

        // Basic data
        const customerName = formData.get("customerName") as string;
        const customerPhone = formData.get("customerPhone") as string;
        const description = formData.get("description") as string;
        const status = formData.get("status") as string;
        const totalAmount = parseFloat(formData.get("totalAmount") as string);
        const paidAmount = parseFloat(formData.get("paidAmount") as string);
        const dueDate = new Date(formData.get("dueDate") as string);
        const factoryId = formData.get("factoryId") as string;
        const shopId = formData.get("shopId") as string;

        // Handle images
        const existingImagesJson = formData.get("existingImages") as string;
        let images: string[] = existingImagesJson ? JSON.parse(existingImagesJson) : [];

        const newImageFiles = formData.getAll("newImages") as File[];
        if (newImageFiles.length > 0) {
            const uploadDir = path.join(process.cwd(), "public", "uploads");
            await mkdir(uploadDir, { recursive: true });

            for (const file of newImageFiles) {
                if (file.size > 0) {
                    const buffer = Buffer.from(await file.arrayBuffer());
                    const filename = `${Date.now()}-${file.name.replace(/\s/g, "_")}`;
                    await writeFile(path.join(uploadDir, filename), buffer);
                    images.push(`/uploads/${filename}`);
                }
            }
        }

        const order = await prisma.order.update({
            where: { id },
            data: {
                customerName,
                customerPhone,
                description,
                status,
                totalAmount,
                paidAmount,
                remainingAmount: totalAmount - paidAmount,
                dueDate,
                factoryId: factoryId || null,
                shopId: shopId || null,
                images: images,
            },
        });

        return NextResponse.json(order);
    } catch (error) {
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
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.ORDERS_DELETE)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const { id } = await params;
        await prisma.order.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Order deleted successfully" });
    } catch {
        return NextResponse.json(
            { error: "Failed to delete order" },
            { status: 500 }
        );
    }
}
