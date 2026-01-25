import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const order = await prisma.order.findUnique({
            where: { id },
        });

        if (!order) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
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
        const { id } = await params;
        const body = await request.json();

        // Ensure numeric fields are parsed correctly
        const dataToUpdate: any = { ...body };
        if (body.totalAmount) dataToUpdate.totalAmount = parseFloat(body.totalAmount);
        if (body.paidAmount) dataToUpdate.paidAmount = parseFloat(body.paidAmount);
        if (body.remainingAmount) dataToUpdate.remainingAmount = parseFloat(body.remainingAmount);

        const order = await prisma.order.update({
            where: { id },
            data: dataToUpdate,
        });

        return NextResponse.json(order);
    } catch (error) {
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
        const { id } = await params;
        await prisma.order.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Order deleted successfully" });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to delete order" },
            { status: 500 }
        );
    }
}
