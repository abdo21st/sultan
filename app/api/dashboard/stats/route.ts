import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";

export async function GET() {
    try {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Total Sales (This Month)
        const salesAgg = await prisma.order.aggregate({
            _sum: {
                totalAmount: true,
            },
            where: {
                createdAt: {
                    gte: firstDayOfMonth,
                },
            },
        });
        const totalSales = salesAgg._sum.totalAmount || 0;

        // 2. Active Orders (Not Completed)
        const activeOrdersCount = await prisma.order.count({
            where: {
                status: {
                    not: "COMPLETED",
                },
            },
        });

        // 3. Total Debts (Remaining Amount > 0)
        const debtsAgg = await prisma.order.aggregate({
            _sum: {
                remainingAmount: true,
            },
            where: {
                remainingAmount: {
                    gt: 0,
                },
            },
        });
        const totalDebts = debtsAgg._sum.remainingAmount || 0;

        // 4. Calculate approximate percentage change (Mocked for now or complex logic needed)
        // For simplicity, we'll return 0 or a placeholder as establishing "last month" change 
        // requires more complex queries.

        return NextResponse.json({
            totalSales,
            activeOrdersCount,
            totalDebts,
        });
    } catch (error) {
        console.error("Dashboard Stats API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch stats", details: String(error) },
            { status: 500 }
        );
    }
}
