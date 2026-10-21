import { endOfDay, isValid, parseISO, startOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequestUser, transactionFacilityWhere } from "@/lib/request-user";
import { fromCents, toCents, toMoneyNumber } from "@/lib/money";
import { decodeDateIdCursor, encodeDateIdCursor, parsePageSize } from "@/lib/keyset-pagination";
import { decodeReportGroupCursor } from '@/lib/report-group-pagination';
import { groupedReport } from '@/lib/report-group-query';
import { PERMISSIONS } from '@/lib/permissions';
import { canReadFinancialReports, reportFacility, reportOrderWhere, reportStatuses } from '@/lib/report-access';
import { ORDER_STATUS } from '@/lib/constants';

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
    const where: Prisma.TransactionWhereInput = transactionFacilityWhere(facilityId);
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    return where;
}

export async function GET(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user?.permissions.includes(PERMISSIONS.DASHBOARD_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get("type") || "financial";
        const dateFilter = parseDateFilter(searchParams);
        const facilityId = reportFacility(user, searchParams.get("facilityId"));
        if (facilityId === false) return NextResponse.json({ error: 'لا يمكنك عرض تقارير منشأة خارج نطاقك. اربط الحساب بمنشأة أو امنحه صلاحية متابعة جميع المنشآت.' }, { status: 403 });
        const financialAccess = canReadFinancialReports(user);
        const showAmounts = user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);
        if ((reportType === 'financial' || reportType === 'users') && !financialAccess) return NextResponse.json({ error: 'يلزم الاطلاع المالي وعرض الحركات المالية.' }, { status: 403 });
        const statuses = reportStatuses(user);
        const limit = parsePageSize(searchParams.get("limit"));
        const isGrouped = reportType === 'production' || reportType === 'users';
        const cursor = isGrouped ? null : decodeDateIdCursor(searchParams.get("cursor"));
        const groupCursor = reportType === 'production' || reportType === 'users' ? decodeReportGroupCursor(searchParams.get('cursor'), reportType) : null;
        if (!dateFilter || !limit || cursor === false || groupCursor === false) {
            return NextResponse.json({ error: "Invalid report filters or pagination parameters." }, { status: 400 });
        }

        let response: NextResponse;
        switch (reportType) {
            case "financial":
                response = await handleFinancialReport(dateFilter, facilityId, cursor, limit);
                break;
            case "operational":
                response = await handleOperationalReport(dateFilter, facilityId, cursor, limit, statuses, showAmounts);
                break;
            case "production":
                response = NextResponse.json(await groupedReport(prisma, 'production', dateFilter, facilityId, groupCursor, limit, { statuses, showAmounts }));
                break;
            case "users":
                response = NextResponse.json(await groupedReport(prisma, 'users', dateFilter, facilityId, groupCursor, limit));
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
            select: { id: true, date: true, type: true, category: true, amount: true, description: true, reversalOfId: true, reversalReason: true },
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
            netCashFlow: fromCents(incomeCents - expenseCents),
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
    statuses: string[] | null,
    showAmounts: boolean,
) {
    const where: Prisma.OrderWhereInput = reportOrderWhere(facilityId, statuses);
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
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
            totalAmount: showAmounts ? toMoneyNumber(order.totalAmount) : undefined,
    }));
    const last = details.at(-1);
    const statusDistribution = groups.map((group) => ({ name: group.status, value: group._count._all }));

    return NextResponse.json({
        type: "operational",
        summary: {
            totalOrders: statusDistribution.reduce((total, group) => total + group.value, 0),
            completedOrders: statusDistribution.filter(group => [ORDER_STATUS.COMPLETED, 'COMPLETED'].includes(group.name)).reduce((total, group) => total + group.value, 0),
            openOrders: statusDistribution.filter(group => ![ORDER_STATUS.COMPLETED, 'COMPLETED', 'orders:status:cancelled', 'CANCELLED', 'orders:status:returned', 'RETURNED'].includes(group.name)).reduce((total, group) => total + group.value, 0),
            statusDistribution,
        },
        details,
        nextCursor: hasMore && last ? encodeDateIdCursor(new Date(last.createdAt), last.id) : null,
    });
}
