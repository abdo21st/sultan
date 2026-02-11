import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
    try {
        console.log("[GET /api/transactions] Request received");
        const session = await auth();
        if (!session?.user?.permissions?.includes(PERMISSIONS.TRANSACTIONS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const transactions = await prisma.transaction.findMany({
            orderBy: { date: "desc" },
        });
        return NextResponse.json(transactions);
    } catch (e) {
        console.error("[GET /api/transactions] Error:", e);
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
    orderId: z.string().optional(), // New field
});

export async function POST(request: Request) {
    try {
        console.log("[POST /api/transactions] Request received");
        const session = await auth();
        console.log("[POST /api/transactions] Session:", session?.user?.id);

        // Permission check: If paying an order, we might need different permission? For now keep TRANSACTIONS_ADD
        if (!session?.user?.permissions?.includes(PERMISSIONS.TRANSACTIONS_ADD)) {
            console.warn("[POST /api/transactions] Unauthorized");
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }
        const json = await request.json();
        const result = transactionSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error.issues[0].message },
                { status: 400 }
            );
        }

        const body = result.data;

        // If orderId is provided, we MUST update the order first (or in transaction)
        if (body.orderId && body.type === 'INCOME') {
            // Verify order exists
            const order = await prisma.order.findUnique({ where: { id: body.orderId } });
            if (!order) {
                return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
            }

            // Link transaction to order implies Paying off debt
            // Update Order: paidAmount += amount, remainingAmount -= amount
            // We use a transaction to ensure atomicity
            const [, newTransaction] = await prisma.$transaction([
                prisma.order.update({
                    where: { id: body.orderId },
                    data: {
                        paidAmount: { increment: body.amount },
                        remainingAmount: { decrement: body.amount }
                    }
                }),
                prisma.transaction.create({
                    data: {
                        type: body.type,
                        amount: body.amount,
                        category: body.category,
                        description: body.description || `دفعة عن طلب #${order.serialNumber}`,
                        orderId: body.orderId,
                        date: body.date ? new Date(body.date) : new Date(),
                        createdBy: session?.user?.id || "System",
                    },
                })
            ]);

            return NextResponse.json(newTransaction);
        }

        // Normal Transaction (No Order Link)
        const transaction = await prisma.transaction.create({
            data: {
                type: body.type,
                amount: body.amount,
                category: body.category,
                description: body.description,
                orderId: body.orderId, // Could be null
                date: body.date ? new Date(body.date) : new Date(),
                createdBy: session?.user?.id || "System",
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
