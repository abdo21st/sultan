import { Prisma } from '@prisma/client';
import { getCapacitySummary } from '@/lib/capacity';
import { PERMISSIONS } from '@/lib/permissions';

type TransactionClient = Prisma.TransactionClient;

export async function createCapacityWarningIfNeeded(
    tx: TransactionClient,
    input: { factoryId: string; factoryName: string; businessDay: string; orderCount: number; rules: Array<{ factoryId: string | null; dayOfWeek: number | null; specificDate: Date | null; maxCapacity: number; warningPercent: number }> },
) {
    const summary = getCapacitySummary(input.rules, input.factoryId, input.businessDay, input.orderCount);
    if (summary.limit === null || summary.warningAt === null || input.orderCount < summary.warningAt) return;

    const claim = await tx.capacityAlert.createMany({
        data: [{
            factoryId: input.factoryId,
            businessDay: new Date(`${input.businessDay}T00:00:00.000Z`),
            orderCount: input.orderCount,
            maxCapacity: summary.limit,
        }],
        skipDuplicates: true,
    });
    if (claim.count === 0) return;

    const recipients = await tx.user.findMany({
        where: {
            OR: [
                { role: 'ADMIN' },
                { permissions: { has: PERMISSIONS.BOOKING_MANAGE } },
                { roles: { some: { permissions: { has: PERMISSIONS.BOOKING_MANAGE } } } },
            ],
        },
        select: { id: true },
    });
    if (recipients.length === 0) return;

    const message = `${input.factoryName}: سُجّل ${input.orderCount} من ${summary.limit} طلباً ليوم ${input.businessDay}. اقتربت السعة من الامتلاء.`;
    await tx.notification.createMany({
        data: recipients.map(recipient => ({
            userId: recipient.id,
            title: 'اقتراب امتلاء سعة الإنتاج',
            message,
            link: `/admin/booking?factoryId=${encodeURIComponent(input.factoryId)}&date=${input.businessDay}`,
        })),
    });
}

