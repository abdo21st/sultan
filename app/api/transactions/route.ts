import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { date: 'desc' }
        });
        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const transaction = await prisma.transaction.create({
            data: {
                type: body.type,
                amount: parseFloat(body.amount),
                category: body.category,
                description: body.description,
                createdBy: body.createdBy,
                date: new Date(),
            },
        });
        return NextResponse.json(transaction);
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to create transaction" },
            { status: 500 }
        );
    }
}
