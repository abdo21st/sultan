import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { fromCents, toCents, toMoneyNumber } from "@/lib/money";
import { decodeDateIdCursor, encodeDateIdCursor, parsePageSize } from "@/lib/keyset-pagination";

interface DateFilter {
    gte?: Date;
    lte?: Date;
}

function parseDateFilter(searchParams: URLSearchParams): DateFilter | null {
    const filter: DateFilter = {};
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (start) {
        const parsed = parseISO(start);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !isValid(parsed)) return null;
        filter.gte = startOfDay(parsed);
    }
    if (end) {
        const parsed = parseISO(end);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !isValid(parsed)) return null;
        filter.lte = endOfDay(parsed);
    }
    if (filter.gte && filter.lte && filter.gte > filter.lte) return null;
    return filter;
}

function transactionWhere(dateFilter: DateFilter, facilityId: string | null): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    if (facilityId) {
        where.OR = [
            { facilityId },
            { order: { is: { OR: [{ factoryId: facilityId }, { shopId: facilityId }] } } },
        ];
    }
    return where;
}

export async function GET(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get("type") || "financial";
        const dateFilter = parseDateFilter(searchParams);
        const facilityId = searchParams.get("facilityId");
        const limit = parsePageSize(searchParams.get("limit"));
        const cursor = decodeDateIdCursor(searchParams.get("cursor"));
        if (!dateFilter || !limit || cursor === false) {
            return NextResponse.json({ error: "Invalid report filters or pagination parameters." }, { status: 400 });
        }

        let response: NextResponse;
        switch (reportType) {
            case "financial":
                response = await handleFinancialReport(dateFilter, facilityId, cursor, limit);
                break;
            case "operational":
                response = await handleOperationalReport(dateFilter, facilityId, cursor, limit);
                break;
            case "production":
                response = await handleProductionReport(dateFilter, facilityId);
                break;
            case "users":
                response = await handleUserActivityReport(dateFilter, facilityId);
                break;
            default:
                return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
        }
        response.headers.set("Cache-Control", "private, no-store");
        return response;
    } catch {
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}

async function handleFinancialReport(
    dateFilter: DateFilter,
    facilityId: string | null,
    cursor: { date: Date; id: string } | null,
    limit: number,
) {
    const where = transactionWhere(dateFilter, facilityId);
    const pageWhere: Prisma.TransactionWhereInput = cursor
        ? { AND: [where, { OR: [{ date: { lt: cursor.date } }, { date: cursor.date, id: { lt: cursor.id } }] }] }
        : where;

    const [page, income, expense, orderPayments] = await Promise.all([
        prisma.transaction.findMany({
            where: pageWhere,
            select: { id: true, date: true, type: true, category: true, amount: true, description: true },
            orderBy: [{ date: "desc" }, { id: "desc" }],
            take: limit + 1,
        }),
        prisma.transaction.aggregate({ where: { AND: [where, { type: "INCOME" }] }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { AND: [where, { type: "EXPENSE" }] }, _sum: { amount: true } }),
        prisma.transaction.aggregate({
            where: { AND: [where, { type: "INCOME", orderId: { not: null } }] },
            _sum: { amount: true },
        }),
    ]);

    const hasMore = page.length > limit;
    const details = (hasMore ? page.slice(0, limit) : page).map((transaction) => ({
        ...transaction,
        date: transaction.date.toISOString(),
        amount: toMoneyNumber(transaction.amount),
    }));
    const incomeCents = toCents(income._sum.amount);
    const expenseCents = toCents(expense._sum.amount);
    const last = details.at(-1);

    return NextResponse.json({
        type: "financial",
        summary: {
            totalIncome: fromCents(incomeCents),
            totalExpense: fromCents(expenseCents),
            netProfit: fromCents(incomeCents - expenseCents),
            orderPayments: fromCents(toCents(orderPayments._sum.amount)),
        },
        details,
        nextCursor: hasMore && last ? encodeDateIdCursor(new Date(last.date), last.id) : null,
    });
}

async function handleOperationalReport(
    dateFilter: DateFilter,
    facilityId: string | null,
    cursor: { date: Date; id: string } | null,
    limit: number,
) {
    const where: Prisma.OrderWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (facilityId) where.shopId = facilityId;
    const pageWhere: Prisma.OrderWhereInput = cursor
        ? { AND: [where, { OR: [{ createdAt: { lt: cursor.date } }, { createdAt: cursor.date, id: { lt: cursor.id } }] }] }
        : where;

    const [page, groups] = await Promise.all([
        prisma.order.findMany({
            where: pageWhere,
            select: { id: true, status: true, totalAmount: true, createdAt: true, customerName: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
        }),
        prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
    ]);

    const hasMore = page.length > limit;
    const details = (hasMore ? page.slice(0, limit) : page).map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
        totalAmount: toMoneyNumber(order.totalAmount),
    }));
    const last = details.at(-1);
    const statusDistribution = groups.map((group) => ({ name: group.status, value: group._count._all }));

    return NextResponse.json({
        type: "operational",
        summary: {
            totalOrders: statusDistribution.reduce((total, group) => total + group.value, 0),
            statusDistribution,
        },
        details,
        nextCursor: hasMore && last ? encodeDateIdCursor(new Date(last.createdAt), last.id) : null,
    });
}

async function handleProductionReport(dateFilter: DateFilter, facilityId: string | null) {
    const where: Prisma.OrderWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (facilityId) where.factoryId = facilityId;

    const groups = await prisma.order.groupBy({
        by: ["factoryId"],
        where,
        _count: { _all: true },
        _sum: { totalAmount: true },
    });
    const facilities = await prisma.facility.findMany({
        where: { id: { in: groups.map((group) => group.factoryId) } },
        select: { id: true, name: true },
    });
    const names = new Map(facilities.map((facility) => [facility.id, facility.name]));
    const details = groups.map((group) => ({
        name: names.get(group.factoryId) ?? "منشأة غير متاحة",
        count: group._count._all,
        value: toMoneyNumber(group._sum.totalAmount),
    })).sort((left, right) => right.value - left.value || left.name.localeCompare(right.name));

    return NextResponse.json({
        type: "production",
        summary: { topFactory: details[0]?.name ?? "N/A" },
        details,
        nextCursor: null,
    });
}

async function handleUserActivityReport(dateFilter: DateFilter, facilityId: string | null) {
    const where = transactionWhere(dateFilter, facilityId);
    const groups = await prisma.transaction.groupBy({
        by: ["createdBy"],
        where,
        _count: { _all: true },
        _sum: { amount: true },
    });
    const userIds = groups.flatMap((group) => group.createdBy ? [group.createdBy] : []);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true },
    });
    const names = new Map(users.map((user) => [user.id, user.displayName]));
    const details = groups.map((group) => {
        const id = group.createdBy ?? "System";
        return {
            id,
            name: id === "System" ? "النظام" : names.get(id) ?? id,
            transactionCount: group._count._all,
            volume: toMoneyNumber(group._sum.amount),
        };
    }).sort((left, right) => right.volume - left.volume || left.name.localeCompare(right.name));

    return NextResponse.json({ type: "users", details, nextCursor: null });
}
