import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/request-user";
import { Prisma } from '@prisma/client';
import { toMoneyNumber } from '@/lib/money';

export async function GET() {
    try {
        const user = await getRequestUser();
        if (!user || user.role !== "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const since = new Date();
        since.setMonth(since.getMonth() - 6);
        const [
            monthlyTotals,
            factoryGroups,
            statusGroups,
            totalAggregates,
            factories
        ] = await Promise.all([
            // Aggregate in PostgreSQL: the response has at most seven partial/full months.
            prisma.$queryRaw<{ month: Date; total: Prisma.Decimal; paid: Prisma.Decimal }[]>`
                SELECT date_trunc('month', "createdAt") AS month,
                    SUM("totalAmount") AS total, SUM("paidAmount") AS paid
                FROM "Order" WHERE "createdAt" >= ${since}
                GROUP BY date_trunc('month', "createdAt") ORDER BY month
            `,

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
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const monthlySales = monthlyTotals.map(row => ({ month: monthNames[row.month.getUTCMonth()], total: toMoneyNumber(row.total), paid: toMoneyNumber(row.paid) }));

        // --- Process Factory Stats ---
        const factoryLookup = new Map(factoryGroups.map(group => [group.factoryId, group]));
        const factoryStats = factories.map(f => {
            const stats = factoryLookup.get(f.id);
            return {
                name: f.name,
                count: stats?._count.id || 0,
                value: Number(stats?._sum.totalAmount || 0)
            };
        }).sort((a, b) => b.value - a.value); // Sort by value desc

        // --- Process Status Counts ---
        const statusCounts: Record<string, number> = {};
        statusGroups.forEach(group => {
            statusCounts[group.status] = group._count.status;
        });

        return NextResponse.json({
            monthlySales,
            factoryStats,
            statusCounts,
            summary: {
                totalOrders: totalAggregates._count.id,
                totalRevenue: Number(totalAggregates._sum.totalAmount || 0),
                totalCollected: Number(totalAggregates._sum.paidAmount || 0)
            }
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
