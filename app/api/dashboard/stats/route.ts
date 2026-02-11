import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";
import { ORDER_STATUS } from "@/lib/constants";

export async function GET() {
    try {
        const session = await auth();

        // Require basic permission to view orders in order to see dashboard stats
        if (!session?.user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

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
                    // Exclude both legacy and new completed values
                    notIn: [ORDER_STATUS.COMPLETED, "COMPLETED"],
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

        // #region agent log
        fetch("http://127.0.0.1:7242/ingest/490d5893-3539-43ca-b492-240d3ed9fa0c", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: `log_${Date.now()}_dashboard_stats`,
                timestamp: Date.now(),
                runId: "pre-fix",
                hypothesisId: "H1",
                location: "app/api/dashboard/stats/route.ts:GET",
                message: "Dashboard stats computed",
                data: {
                    userId: session.user.id,
                    totalSales,
                    activeOrdersCount,
                    totalDebts,
                },
            }),
        }).catch(() => {});
        // #endregion agent log

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
