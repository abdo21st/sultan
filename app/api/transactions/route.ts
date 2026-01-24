import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: { date: "desc" },
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
        const session = await auth();
        const body = await request.json();

        // Basic validation
        if (!body.amount || !body.type || !body.category) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const transaction = await prisma.transaction.create({
            data: {
                type: body.type, // INCOME or EXPENSE
                amount: parseFloat(body.amount),
                category: body.category,
                description: body.description,
                date: body.date ? new Date(body.date) : new Date(),
                createdBy: session?.user?.email || session?.user?.name || "System",
            },
        });

        return NextResponse.json(transaction);
    } catch (error) {
        console.error("Transaction creation error:", error);
        return NextResponse.json(
            { error: "Failed to create transaction" },
            { status: 500 }
        );
    }
}
