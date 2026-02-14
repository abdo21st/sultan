import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { Prisma } from "@prisma/client";

interface DateFilter {
    gte?: Date;
    lte?: Date;
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get("type") || "financial";
        const startDate = searchParams.get("start");
        const endDate = searchParams.get("end");
        const facilityId = searchParams.get("facilityId");

        const dateFilter: DateFilter = {};
        if (startDate) dateFilter.gte = startOfDay(parseISO(startDate));
        if (endDate) dateFilter.lte = endOfDay(parseISO(endDate));

        switch (reportType) {
            case "financial":
                return handleFinancialReport(dateFilter);
            case "operational":
                return handleOperationalReport(dateFilter, facilityId);
            case "production":
                return handleProductionReport(dateFilter, facilityId);
            case "users":
                return handleUserActivityReport(dateFilter);
            default:
                return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
        }
    } catch (error) {
        console.error("Report API Error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}

async function handleFinancialReport(dateFilter: DateFilter) {
    const where: Prisma.TransactionWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

    // Transactions report
    const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" }
    });

    const income = transactions.filter(t => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions.filter(t => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);

    // Sum of order payments specifically
    const orderPayments = transactions.filter(t => t.orderId !== null && t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);

    return NextResponse.json({
        type: "financial",
        summary: {
            totalIncome: income,
            totalExpense: expense,
            netProfit: income - expense,
            orderPayments
        },
        details: transactions
    });
}

async function handleOperationalReport(dateFilter: DateFilter, facilityId: string | null) {
    const where: Prisma.OrderWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (facilityId) where.shopId = facilityId;

    const orders = await prisma.order.findMany({
        where,
        select: {
            id: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            customerName: true
        },
        orderBy: { createdAt: "desc" }
    });

    const statusCounts: Record<string, number> = {};
    orders.forEach(o => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    return NextResponse.json({
        type: "operational",
        summary: {
            totalOrders: orders.length,
            statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
        },
        details: orders
    });
}

async function handleProductionReport(dateFilter: DateFilter, facilityId: string | null) {
    const where: Prisma.OrderWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;
    if (facilityId) where.factoryId = facilityId;

    const orders = await prisma.order.findMany({
        where,
        select: {
            factoryId: true,
            totalAmount: true,
            factory: { select: { name: true } }
        }
    });

    const factoryPerformance: Record<string, { name: string, count: number, value: number }> = {};
    orders.forEach(o => {
        if (!factoryPerformance[o.factoryId]) {
            factoryPerformance[o.factoryId] = { name: o.factory.name, count: 0, value: 0 };
        }
        factoryPerformance[o.factoryId].count += 1;
        factoryPerformance[o.factoryId].value += o.totalAmount;
    });

    return NextResponse.json({
        type: "production",
        summary: {
            topFactory: Object.values(factoryPerformance).sort((a, b) => b.value - a.value)[0]?.name || "N/A"
        },
        details: Object.values(factoryPerformance)
    });
}

async function handleUserActivityReport(dateFilter: DateFilter) {
    const where: Prisma.TransactionWhereInput = {};
    if (Object.keys(dateFilter).length > 0) where.date = dateFilter;

    // This is simple: just count orders by each user who created them
    // Note: Transaction has 'createdBy' field which is user ID
    const transactions = await prisma.transaction.findMany({
        where,
        select: { createdBy: true, amount: true }
    });

    const userStats: Record<string, { id: string, name: string, transactionCount: number, volume: number }> = {};

    // Get all unique user IDs from transactions
    const userIds = new Set<string>();
    transactions.forEach(t => {
        if (t.createdBy) userIds.add(t.createdBy);
    });

    // Fetch user details
    const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, displayName: true }
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    transactions.forEach(t => {
        const userId = t.createdBy || "System";
        const userName = userId === "System" ? "النظام" : (userMap.get(userId) || userId);

        if (!userStats[userId]) {
            userStats[userId] = { id: userId, name: userName, transactionCount: 0, volume: 0 };
        }
        userStats[userId].transactionCount += 1;
        userStats[userId].volume += t.amount;
    });

    return NextResponse.json({
        type: "users",
        details: Object.values(userStats)
    });
}
