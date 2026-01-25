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
        const body = await request.json();

        // Ensure numeric fields are parsed correctly
        const dataToUpdate: Record<string, unknown> = { ...body };
        if (body.totalAmount) dataToUpdate.totalAmount = parseFloat(body.totalAmount);
        if (body.paidAmount) dataToUpdate.paidAmount = parseFloat(body.paidAmount);
        if (body.remainingAmount) dataToUpdate.remainingAmount = parseFloat(body.remainingAmount);
        if (body.dueDate) dataToUpdate.dueDate = new Date(body.dueDate);

        const order = await prisma.order.update({
            where: { id },
            data: dataToUpdate,
        });

        return NextResponse.json(order);
    } catch {
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
