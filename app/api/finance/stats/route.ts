import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/permissions";
import { getRequestUser, orderFacilityFilter } from "@/lib/request-user";
import { Prisma } from "@prisma/client";

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
        };
        const transactionWhere: Prisma.TransactionWhereInput = user.role === "ADMIN"
            ? {}
            : user.facilityId
                ? {
                    OR: [
                        { facilityId: user.facilityId },
                        { order: { is: { OR: [{ factoryId: user.facilityId }, { shopId: user.facilityId }] } } },
                    ],
                }
                : { id: "__no_assigned_facility__" };

        const [ordersAgg, transactionAgg] = await Promise.all([
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
            })
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
