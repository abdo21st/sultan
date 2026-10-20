import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { canAccessOrderFacility, getRequestUser, type RequestUser } from "@/lib/request-user";
import { fromCents, toCents, toMoneyNumber } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { decodeDateIdCursor, encodeDateIdCursor, parsePageSize } from "@/lib/keyset-pagination";
import { moneyAmountSchema } from "@/lib/schemas";

export async function GET(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!user.permissions.includes(PERMISSIONS.TRANSACTIONS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const where: Prisma.TransactionWhereInput = user.role === "ADMIN"
            ? {}
            : user.facilityId
                ? {
                    OR: [
                        { facilityId: user.facilityId },
                        { order: { is: { OR: [{ factoryId: user.facilityId }, { shopId: user.facilityId }] } } },
                    ],
                }
                : { id: "__no_assigned_facility__" };

        const searchParams = new URL(request.url).searchParams;
        const limit = parsePageSize(searchParams.get('limit'));
        const cursor = decodeDateIdCursor(searchParams.get('cursor'));
        if (!limit || cursor === false) return NextResponse.json({ error: "Invalid pagination parameters." }, { status: 400 });
        if (cursor) {
            const existingAnd = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
            where.AND = [...existingAnd, {
                OR: [
                    { date: { lt: cursor.date } },
                    { date: cursor.date, id: { lt: cursor.id } },
                ],
            }];
        }

        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: [{ date: "desc" }, { id: "desc" }],
            take: limit + 1,
            include: { reversedBy: { select: { id: true } } },
        });
        const hasMore = transactions.length > limit;
        const page = hasMore ? transactions.slice(0, limit) : transactions;
        const nextCursor = hasMore && page.length > 0
            ? encodeDateIdCursor(page[page.length - 1].date, page[page.length - 1].id)
            : null;
        return NextResponse.json(page.map((transaction) => transactionResponse(transaction)), {
            headers: nextCursor ? { 'X-Next-Cursor': nextCursor } : undefined,
        });
    } catch (error) {
        console.error("Transaction list failed:", error);
        return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }
}

const transactionSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]),
    amount: moneyAmountSchema.refine((value) => value > 0, "المبلغ يجب أن يكون قيمة موجبة"),
    category: z.string().trim().min(2, "التصنيف يجب أن يكون حرفين على الأقل").max(100),
    description: z.string().max(2000).optional(),
    date: z.string().optional().refine((value) => !value || !Number.isNaN(Date.parse(value)), {
        message: "التاريخ غير صحيح",
    }),
    orderId: z.string().optional(),
    idempotencyKey: z.string().uuid().optional(),
});

function samePayment(
    transaction: { type: string; amount: Prisma.Decimal | number; category: string; orderId: string | null },
    expected: { type: string; amount: number; category: string; orderId: string },
) {
    return transaction.type === expected.type &&
        Math.round(toMoneyNumber(transaction.amount) * 100) === Math.round(expected.amount * 100) &&
        transaction.category === expected.category &&
        transaction.orderId === expected.orderId;
}

async function existingPaymentResponse(
    user: RequestUser,
    idempotencyKey: string,
    expectedPayment: { type: string; amount: number; category: string; orderId: string },
): Promise<NextResponse | null> {
    const existing = await prisma.transaction.findUnique({ where: { idempotencyKey } });
    if (!existing) return null;

    const order = existing.orderId
        ? await prisma.order.findUnique({
            where: { id: existing.orderId },
            select: { factoryId: true, shopId: true },
        })
        : null;
    if (!order || !canAccessOrderFacility(user, order)) {
        return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }
    if (!samePayment(existing, expectedPayment)) {
        return NextResponse.json({ error: "Idempotency key was already used for a different payment." }, { status: 409 });
    }
    return NextResponse.json(transactionResponse(existing));
}

export async function POST(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!user.permissions.includes(PERMISSIONS.TRANSACTIONS_ADD)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const parsed = transactionSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid transaction" }, { status: 400 });
        }

        const body = parsed.data;
        const amount = Math.round((body.amount + Number.EPSILON) * 100) / 100;

        if (body.orderId) {
            if (body.type !== "INCOME") {
                return NextResponse.json({ error: "Order-linked transactions must be income payments." }, { status: 400 });
            }
            if (user.role !== "ADMIN" && !user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS)) {
                return NextResponse.json({ error: "Financial access is required to record an order payment." }, { status: 403 });
            }
            if (!body.idempotencyKey) {
                return NextResponse.json({ error: "Payment idempotency key is required." }, { status: 400 });
            }

            const expectedPayment = { type: body.type, amount, category: body.category, orderId: body.orderId };
            const replay = await existingPaymentResponse(user, body.idempotencyKey, expectedPayment);
            if (replay) return replay;

            try {
                const transaction = await prisma.$transaction(async (tx) => {
                    const order = await tx.order.findUnique({
                        where: { id: body.orderId },
                        select: { id: true, serialNumber: true, paidAmount: true, remainingAmount: true, factoryId: true, shopId: true, status: true },
                    });
                    if (!order) throw new Error("ORDER_NOT_FOUND");
                    if (!canAccessOrderFacility(user, order)) throw new Error("ORDER_FORBIDDEN");

                    const updated = await tx.order.updateMany({
                        where: { id: order.id, remainingAmount: { gte: amount } },
                        data: {
                            paidAmount: { increment: amount },
                            remainingAmount: { decrement: amount },
                        },
                    });
                    if (updated.count !== 1) throw new Error("ORDER_PAYMENT_CONFLICT");
                    const updatedOrder = await tx.order.findUniqueOrThrow({
                        where: { id: order.id },
                        select: { paidAmount: true, remainingAmount: true },
                    });

                    const transaction = await tx.transaction.create({
                        data: {
                            type: body.type,
                            amount,
                            category: body.category,
                            description: body.description || `دفعة عن طلب #${order.serialNumber}`,
                            orderId: order.id,
                            facilityId: user.facilityId ?? order.shopId,
                            idempotencyKey: body.idempotencyKey,
                            date: body.date ? new Date(body.date) : new Date(),
                            createdBy: user.id,
                        },
                    });
                    await writeAudit(tx, {
                        actorId: user.id,
                        entityType: "ORDER",
                        entityId: order.id,
                        action: "PAYMENT_RECORDED",
                        before: {
                            paidAmount: fromCents(toCents(updatedOrder.paidAmount) - toCents(amount)),
                            remainingAmount: fromCents(toCents(updatedOrder.remainingAmount) + toCents(amount)),
                        },
                        after: {
                            paidAmount: toMoneyNumber(updatedOrder.paidAmount),
                            remainingAmount: toMoneyNumber(updatedOrder.remainingAmount),
                            transactionId: transaction.id,
                        },
                    });
                    await writeAudit(tx, {
                        actorId: user.id,
                        entityType: "TRANSACTION",
                        entityId: transaction.id,
                        action: "PAYMENT_RECORDED",
                        after: { orderId: order.id, amount, type: body.type, category: body.category },
                    });
                    return transaction;
                });
                return NextResponse.json(transactionResponse(transaction));
            } catch (error) {
                if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
                    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
                }
                if (error instanceof Error && error.message === "ORDER_FORBIDDEN") {
                    return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
                }
                if (error instanceof Error && error.message === "ORDER_PAYMENT_CONFLICT") {
                    // A concurrent retry may observe the balance after the first request collected it in full.
                    const replay = await existingPaymentResponse(user, body.idempotencyKey, expectedPayment);
                    if (replay) return replay;
                    return NextResponse.json({ error: "مبلغ التحصيل أكبر من المبلغ المتبقي أو تغيرت بيانات الطلب." }, { status: 409 });
                }
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                    const replay = await existingPaymentResponse(user, body.idempotencyKey, expectedPayment);
                    if (replay) return replay;
                    return NextResponse.json({ error: "Payment key conflict." }, { status: 409 });
                }
                throw error;
            }
        }

        if (user.role !== "ADMIN" && !user.facilityId) {
            return NextResponse.json({ error: "Assign a facility before recording transactions." }, { status: 403 });
        }

        const transaction = await prisma.$transaction(async (tx) => {
            const createdTransaction = await tx.transaction.create({
                data: {
                    type: body.type,
                    amount,
                    category: body.category,
                    description: body.description,
                    facilityId: user.facilityId,
                    date: body.date ? new Date(body.date) : new Date(),
                    createdBy: user.id,
                },
            });
            await writeAudit(tx, {
                actorId: user.id,
                entityType: "TRANSACTION",
                entityId: createdTransaction.id,
                action: "CREATED",
                after: { type: body.type, amount, category: body.category, facilityId: user.facilityId },
            });
            return createdTransaction;
        });
        return NextResponse.json(transactionResponse(transaction));
    } catch (error) {
        console.error("Transaction creation failed:", error);
        return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
    }
}

function transactionResponse<T extends { amount: Prisma.Decimal | number }>(transaction: T) {
    return { ...transaction, amount: toMoneyNumber(transaction.amount) };
}
