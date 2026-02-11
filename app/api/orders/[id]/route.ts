import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";
import { saveFile } from "../../../../lib/upload";
import { orderSchema } from "@/lib/schemas";


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

        // Prepare data for validation (Status is ignored as per design)
        const dataToValidate = {
            customerName: formData.get("customerName"),
            customerPhone: formData.get("customerPhone"),
            description: formData.get("description"),
            dueDate: formData.get("dueDate"),
            totalAmount: formData.get("totalAmount"),
            paidAmount: formData.get("paidAmount"),
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

        // Handle images
        const existingImagesJson = formData.get("existingImages") as string;
        const images: string[] = existingImagesJson ? JSON.parse(existingImagesJson) : [];

        const newImageFiles = formData.getAll("newImages") as File[];
        if (newImageFiles.length > 0) {
            for (const file of newImageFiles) {
                const path = await saveFile(file, "order");
                if (path) images.push(path);
            }
        }

        const order = await prisma.order.update({
            where: { id },
            data: {
                customerName: body.customerName,
                customerPhone: body.customerPhone,
                description: body.description,
                totalAmount: body.totalAmount,
                paidAmount: body.paidAmount,
                remainingAmount: body.totalAmount - body.paidAmount,
                dueDate: new Date(body.dueDate),
                factoryId: body.factoryId || undefined,
                shopId: body.shopId || undefined,
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
