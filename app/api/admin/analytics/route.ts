import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "../../../../auth";
import { PERMISSIONS } from "../../../../lib/permissions";

export async function GET() {
    try {
        const session = await auth();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Sales over time (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const orders = await prisma.order.findMany({
            where: {
                createdAt: { gte: sixMonthsAgo }
            },
            select: {
                createdAt: true,
                totalAmount: true,
                paidAmount: true,
                factoryId: true,
                status: true
            }
        });

        // Group by month
        const monthlySales: Record<string, { month: string, total: number, paid: number }> = {};
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

        orders.forEach(order => {
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

        // 2. Factory Performance
        const factories = await prisma.facility.findMany({
            where: { type: 'FACTORY' }
        });

        const factoryStats = factories.map(f => {
            const factoryOrders = orders.filter(o => o.factoryId === f.id);
            return {
                name: f.name,
                count: factoryOrders.length,
                value: factoryOrders.reduce((sum, o) => sum + o.totalAmount, 0)
            };
        });

        // 3. Status Distribution
        const statusCounts: Record<string, number> = {};
        orders.forEach(o => {
            statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        });

        return NextResponse.json({
            monthlySales: Object.values(monthlySales),
            factoryStats,
            statusCounts,
            summary: {
                totalOrders: orders.length,
                totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
                totalCollected: orders.reduce((sum, o) => sum + o.paidAmount, 0)
            }
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
