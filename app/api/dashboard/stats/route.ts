import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";
import { ORDER_STATUS } from "@/lib/constants";
import { startOfMonth, endOfMonth, eachDayOfInterval, format, startOfDay, endOfDay } from "date-fns";

export async function GET() {
    try {
        const session = await auth();

        // Require basic permission to view orders in order to see dashboard stats
        if (!session?.user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const now = new Date();
        const firstDayOfMonth = startOfMonth(now);
        const lastDayOfMonth = endOfMonth(now);

        // 1. Total Sales (This Month)
        const salesAgg = await prisma.order.aggregate({
            _sum: {
                totalAmount: true,
            },
            where: {
                createdAt: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth,
                },
            },
        });
        const totalSales = salesAgg._sum.totalAmount || 0;

        // 2. Active Orders (Not Completed)
        const activeOrdersCount = await prisma.order.count({
            where: {
                status: {
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

        // 4. Sales Trends (Daily for this month)
        const days = eachDayOfInterval({ start: firstDayOfMonth, end: now });

        const dailySales = await Promise.all(days.map(async (day) => {
            const dayAgg = await prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    createdAt: {
                        gte: startOfDay(day),
                        lte: endOfDay(day)
                    }
                }
            });
            return {
                date: format(day, 'MMM dd'),
                sales: dayAgg._sum.totalAmount || 0
            };
        }));

        // 5. Status Distribution
        const statuses = [
            { label: 'قيد الانتظار', status: ORDER_STATUS.PENDING },
            { label: 'قيد التنفيذ', status: ORDER_STATUS.PROCESSING },
            { label: 'جاهز للاستلام', status: ORDER_STATUS.READY },
            { label: 'مكتمل', status: ORDER_STATUS.COMPLETED }
        ];

        const statusDistribution = await Promise.all(statuses.map(async (s) => {
            const count = await prisma.order.count({
                where: { status: s.status }
            });
            return { name: s.label, value: count };
        }));

        return NextResponse.json({
            totalSales,
            activeOrdersCount,
            totalDebts,
            dailySales,
            statusDistribution,
            growth: 12 // Placeholder for growth calculation
        });
    } catch (error) {
        console.error("Dashboard Stats API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch stats", details: String(error) },
            { status: 500 }
        );
    }
}
