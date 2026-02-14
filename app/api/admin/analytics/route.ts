import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        // Parallelize requests for maximum performance
        const [
            monthlyOrders,
            factoryGroups,
            statusGroups,
            totalAggregates,
            factories
        ] = await Promise.all([
            // 1. Sales over time (last 6 months only) - Optimized Select
            prisma.order.findMany({
                where: {
                    createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
                },
                select: {
                    createdAt: true,
                    totalAmount: true,
                    paidAmount: true
                },
                orderBy: { createdAt: 'asc' }
            }),

            // 2. Factory Performance (All Time) - DB GroupBy
            prisma.order.groupBy({
                by: ['factoryId'],
                _count: { id: true },
                _sum: { totalAmount: true }
            }),

            // 3. Status Distribution (All Time) - DB GroupBy
            prisma.order.groupBy({
                by: ['status'],
                _count: { status: true }
            }),

            // 4. Global Summary (All Time) - DB Aggregate
            prisma.order.aggregate({
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    paidAmount: true
                }
            }),

            // Fetch factory info to map names
            prisma.facility.findMany({
                where: { type: 'FACTORY' },
                select: { id: true, name: true }
            })
        ]);

        // --- Process Monthly Sales ---
        const monthlySales: Record<string, { month: string, total: number, paid: number }> = {};
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

        monthlyOrders.forEach(order => {
            const date = new Date(order.createdAt);
            const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
            if (!monthlySales[monthKey]) {
                monthlySales[monthKey] = {
                    month: monthNames[date.getMonth()],
                    total: 0,
                    paid: 0
                };
            }
            monthlySales[monthKey].total += order.totalAmount;
            monthlySales[monthKey].paid += order.paidAmount;
        });

        // --- Process Factory Stats ---
        const factoryStats = factories.map(f => {
            const stats = factoryGroups.find(g => g.factoryId === f.id);
            return {
                name: f.name,
                count: stats?._count.id || 0,
                value: stats?._sum.totalAmount || 0
            };
        }).sort((a, b) => b.value - a.value); // Sort by value desc

        // --- Process Status Counts ---
        const statusCounts: Record<string, number> = {};
        statusGroups.forEach(group => {
            statusCounts[group.status] = group._count.status;
        });

        return NextResponse.json({
            monthlySales: Object.values(monthlySales),
            factoryStats,
            statusCounts,
            summary: {
                totalOrders: totalAggregates._count.id,
                totalRevenue: totalAggregates._sum.totalAmount || 0,
                totalCollected: totalAggregates._sum.paidAmount || 0
            }
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
