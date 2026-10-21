import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { getRequestUser, orderFacilityFilter, transactionFacilityFilter } from "@/lib/request-user";
import { CLOSED_ORDER_STATUSES } from '@/lib/constants';
import { Prisma } from "@prisma/client";
import { fromCents, toCents } from '@/lib/money';

export async function GET() {
    try {
        const user = await getRequestUser();
        // Permission check
        if (!user?.permissions.includes(PERMISSIONS.TRANSACTIONS_VIEW)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const orderWhere: Prisma.OrderWhereInput = {
            ...orderFacilityFilter(user),
            remainingAmount: { gt: 0 },
            status: { notIn: CLOSED_ORDER_STATUSES },
        };
        const transactionWhere = transactionFacilityFilter(user);

        const [ordersAgg, transactionAgg, refundsAgg] = await Promise.all([
            // Calculate Total Debt (Sum of remainingAmount on Orders)
            prisma.order.aggregate({
                _sum: {
                    remainingAmount: true,
                },
                where: orderWhere,
            }),
            // Calculate Treasury Balance (Income - Expenses)
            // Since we can't do complex math in aggregate easily across rows with different types, 
            // we might have to do two queries or one grouped query.
            prisma.transaction.groupBy({
                where: transactionWhere,
                by: ['type'],
                _sum: {
                    amount: true
                }
            }),
            prisma.orderAdjustment.aggregate({ where: { status: 'APPROVED', order: { is: orderFacilityFilter(user) } }, _sum: { refundAmount: true, refundedAmount: true } }),
        ]);

        const totalDebt = Number(ordersAgg._sum.remainingAmount || 0);

        let totalIncome = 0;
        let totalExpense = 0;

        transactionAgg.forEach((group) => {
            if (group.type === 'INCOME') totalIncome = Number(group._sum.amount || 0);
            if (group.type === 'EXPENSE') totalExpense = Number(group._sum.amount || 0);
        });

        const treasuryBalance = totalIncome - totalExpense;

        return NextResponse.json({
            totalDebt,
            treasuryBalance,
            totalIncome,
            totalExpense,
            pendingRefunds: fromCents(toCents(refundsAgg._sum.refundAmount) - toCents(refundsAgg._sum.refundedAmount)),
        });

    } catch (error) {
        console.error("Finance stats error:", error);
        return NextResponse.json(
            { error: "Failed to fetch finance stats" },
            { status: 500 }
        );
    }
}
