import { prisma } from '@/lib/prisma';
import { getRequestUser, orderFacilityFilter } from '@/lib/request-user';
import { reportStatuses } from '@/lib/report-access';
import { PERMISSIONS } from '@/lib/permissions';
import { adjustmentResponse } from '@/lib/order-adjustments';
import { decodeDateIdCursor, encodeDateIdCursor, parsePageSize } from '@/lib/keyset-pagination';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
    const user = await getRequestUser();
    if (!user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) return Response.json({ error: 'غير مصرح' }, { status: 403 });
    const query = new URL(request.url).searchParams;
    const cursor = decodeDateIdCursor(query.get('cursor'));
    const limit = parsePageSize(query.get('limit'));
    const status = query.get('status') || 'REQUESTED';
    if (!limit || cursor === false || !['REQUESTED', 'APPROVED', 'REJECTED', 'ALL'].includes(status)) return Response.json({ error: 'تصفية غير صحيحة.' }, { status: 400 });
    const statuses = reportStatuses(user);
    const where: Prisma.OrderAdjustmentWhereInput = {
        order: { is: { AND: [orderFacilityFilter(user), ...(statuses ? [{ status: { in: statuses } }] : [])] } },
        ...(status !== 'ALL' ? { status } : {}),
        ...(cursor ? { OR: [{ requestedAt: { lt: cursor.date } }, { requestedAt: cursor.date, id: { lt: cursor.id } }] } : {}),
    };
    const rows = await prisma.orderAdjustment.findMany({ where, orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], take: limit + 1,
        include: { order: { select: { id: true, serialNumber: true, customerName: true, status: true } } } });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return Response.json({ items: page.map(item => adjustmentResponse(item, user.permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS))),
        nextCursor: hasMore && last ? encodeDateIdCursor(last.requestedAt, last.id) : null }, { headers: { 'Cache-Control': 'private, no-store' } });
}
