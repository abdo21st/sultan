import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET() {
    try {
        const session = await auth();
        // Permission check
        if (!session?.user?.permissions?.includes(PERMISSIONS.TRANSACTIONS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const [ordersAgg, transactionAgg] = await Promise.all([
            // Calculate Total Debt (Sum of remainingAmount on Orders)
            prisma.order.aggregate({
                _sum: {
                    remainingAmount: true,
                },
                where: {
                    remainingAmount: { gt: 0 } // Only orders with debt
                }
            }),
            // Calculate Treasury Balance (Income - Expenses)
            // Since we can't do complex math in aggregate easily across rows with different types, 
            // we might have to do two queries or one grouped query.
            prisma.transaction.groupBy({
                by: ['type'],
                _sum: {
                    amount: true
                }
            })
        ]);

        const totalDebt = ordersAgg._sum.remainingAmount || 0;

        let totalIncome = 0;
        let totalExpense = 0;

        transactionAgg.forEach((group: { type: string, _sum: { amount: number | null } }) => {
            if (group.type === 'INCOME') totalIncome = group._sum.amount || 0;
            if (group.type === 'EXPENSE') totalExpense = group._sum.amount || 0;
        });

        const treasuryBalance = totalIncome - totalExpense;

        return NextResponse.json({
            totalDebt,
            treasuryBalance,
            totalIncome,
            totalExpense
        });

    } catch (error) {
        console.error("Finance stats error:", error);
        return NextResponse.json(
            { error: "Failed to fetch finance stats" },
            { status: 500 }
        );
    }
}
