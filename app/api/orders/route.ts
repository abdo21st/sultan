import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const orders = await prisma.order.findMany({
            orderBy: { createdAt: "desc" },
        });
        return NextResponse.json(orders);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch orders" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const order = await prisma.order.create({
            data: {
                customerName: body.customerName,
                customerPhone: body.customerPhone,
                description: body.description,
                dueDate: body.dueDate,
                totalAmount: parseFloat(body.totalAmount),
                paidAmount: parseFloat(body.paidAmount || 0),
                remainingAmount: parseFloat(body.remainingAmount || 0),
                factoryId: body.factoryId,
                shopId: body.shopId,
                status: "REGISTERED",
            },
        });
        return NextResponse.json(order);
    } catch (error) {
        console.error("Error creating order:", error);
        return NextResponse.json(
            { error: "Failed to create order" },
            { status: 500 }
        );
    }
}
