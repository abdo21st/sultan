import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../auth";

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

import { z } from "zod";

const transactionSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: z.preprocess((val) => parseFloat(val as string), z.number().positive("المبلغ يجب أن يكون قيمة موجبة")),
    category: z.string().min(2, "التصنيف يجب أن يكون حرفين على الأقل"),
    description: z.string().optional(),
    date: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "التاريخ غير صحيح",
    }),
});

export async function POST(request: Request) {
    try {
        const session = await auth();
        const json = await request.json();
        const result = transactionSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;

        const transaction = await prisma.transaction.create({
            data: {
                type: body.type,
                amount: body.amount,
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
