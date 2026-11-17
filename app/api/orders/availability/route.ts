import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { PERMISSIONS } from '@/lib/permissions';
import { canAccessAllFacilities, getRequestUser } from '@/lib/request-user';
import { businessDateKey } from '@/lib/business-date';
import { businessDateStart, getCapacitySummary } from '@/lib/capacity';
import { findNearestAvailablePickup, hasPreparationConflict, parseBusinessDateTime } from '@/lib/preparation-schedule';
import { ORDER_STATUS } from '@/lib/constants';

const querySchema = z.object({
    factoryId: z.string().min(1),
    shopId: z.string().min(1),
    pickupAt: z.string().min(1),
});

export async function GET(request: Request) {
    try {
        const user = await getRequestUser();
        if (!user || !user.permissions.includes(PERMISSIONS.ORDERS_ADD)) {
            return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
        }
        const params = Object.fromEntries(new URL(request.url).searchParams.entries());
        const parsed = querySchema.safeParse(params);
        if (!parsed.success) return NextResponse.json({ error: 'اختر المصنع والمحل ووقت الاستلام.' }, { status: 400 });
        const requestedAt = parseBusinessDateTime(parsed.data.pickupAt);
        if (!requestedAt) return NextResponse.json({ error: 'وقت الاستلام غير صحيح.' }, { status: 400 });

        const [factory, shop] = await Promise.all([
            prisma.facility.findUnique({ where: { id: parsed.data.factoryId }, select: { id: true, name: true, type: true, preparationMinutes: true } }),
            prisma.facility.findUnique({ where: { id: parsed.data.shopId }, select: { id: true, type: true } }),
        ]);
        if (factory?.type !== 'FACTORY' || shop?.type !== 'SHOP') return NextResponse.json({ error: 'اختر مصنعاً ومَحلاً صالحين.' }, { status: 400 });
        if (!canAccessAllFacilities(user) && (!user.facilityId || ![factory.id, shop.id].includes(user.facilityId))) {
            return NextResponse.json({ error: 'لا يمكنك التحقق من مواعيد هذه المنشأة.' }, { status: 403 });
        }

        const requestedDay = businessDateKey(requestedAt);
        const dayStart = businessDateStart(requestedDay);
        const endDay = new Date(dayStart.getTime() + 31 * 24 * 60 * 60_000);
        const lowerBound = new Date(dayStart.getTime() - 24 * 60 * 60_000);
        const [rules, orders] = await Promise.all([
            prisma.capacityRule.findMany({ where: { OR: [{ factoryId: null }, { factoryId: factory.id }] } }),
            prisma.order.findMany({
                where: {
                    factoryId: factory.id,
                    status: { notIn: [ORDER_STATUS.CANCELLED, 'CANCELLED'] },
                    OR: [
                        { dueDate: { gte: lowerBound, lte: endDay } },
                        { pickupAt: { gte: lowerBound, lte: endDay } },
                    ],
                },
                select: { dueDate: true, pickupAt: true, preparationMinutes: true },
            }),
        ]);

        const bookings = orders.filter(order => order.pickupAt !== null).map(order => ({ pickupAt: order.pickupAt!, preparationMinutes: order.preparationMinutes }));
        const dailyCounts = new Map<string, number>();
        for (const order of orders) {
            const day = businessDateKey(order.dueDate);
            dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
        }
        const countFor = (day: string) => dailyCounts.get(day) ?? 0;
        const currentCount = countFor(requestedDay);
        const currentSummary = getCapacitySummary(rules, factory.id, requestedDay, currentCount);
        const exactSlotBusy = hasPreparationConflict(requestedAt, factory.preparationMinutes, bookings);
        const prepCanStart = requestedAt.getTime() - factory.preparationMinutes * 60_000 >= Date.now();
        const capacityFull = currentSummary.full;
        const available = !capacityFull && !exactSlotBusy && prepCanStart;
        const suggestedPickupAt = available ? null : findNearestAvailablePickup(
            requestedAt,
            factory.preparationMinutes,
            bookings,
            new Date(),
            candidate => !getCapacitySummary(rules, factory.id, businessDateKey(candidate), countFor(businessDateKey(candidate))).full,
        );
        const afterSummary = getCapacitySummary(rules, factory.id, requestedDay, currentCount + 1);

        return NextResponse.json({
            available,
            reason: capacityFull ? 'capacity' : exactSlotBusy ? 'busy' : !prepCanStart ? 'preparation_time' : null,
            requestedAt: requestedAt.toISOString(),
            suggestedPickupAt: suggestedPickupAt?.toISOString() ?? null,
            preparationMinutes: factory.preparationMinutes,
            factoryName: factory.name,
            capacity: {
                current: currentCount,
                limit: currentSummary.limit,
                remainingAfterBooking: currentSummary.limit === null ? null : Math.max(0, currentSummary.limit - currentCount - 1),
                warningAt: currentSummary.warningAt,
                approaching: afterSummary.approaching,
                full: capacityFull,
            },
        });
    } catch {
        return NextResponse.json({ error: 'تعذر التحقق من وقت التجهيز الآن.' }, { status: 500 });
    }
}

