import { Prisma, type PrismaClient } from '@prisma/client';
import { toMoneyNumber } from './money';
import { encodeReportGroupCursor, type ReportGroupCursor, type ReportGroupKind } from './report-group-pagination';
type RawGroup = { id: string; name: string; count: number; value: string };

export async function groupedReport(client: Pick<PrismaClient, '$queryRaw'>, kind: ReportGroupKind, dates: { gte?: Date; lte?: Date }, facilityId: string | null, cursor: ReportGroupCursor | null, limit: number, options: { statuses?: string[] | null; showAmounts?: boolean } = {}) {
    const filters: Prisma.Sql[] = [Prisma.sql`true`];
    const date = kind === 'production' ? Prisma.sql`o."createdAt"` : Prisma.sql`t.date`;
    if (dates.gte) filters.push(Prisma.sql`${date} >= ${dates.gte}`);
    if (dates.lte) filters.push(Prisma.sql`${date} <= ${dates.lte}`);
    if (facilityId) filters.push(kind === 'production' ? Prisma.sql`(o."factoryId"=${facilityId} OR o."shopId"=${facilityId})` : Prisma.sql`(t."facilityId"=${facilityId} OR EXISTS(SELECT 1 FROM "Order" o WHERE o.id=t."orderId" AND (o."factoryId"=${facilityId} OR o."shopId"=${facilityId})) OR EXISTS(SELECT 1 FROM "OrderAdjustment" a JOIN "Order" o ON o.id=a."orderId" WHERE a.id=t."adjustmentId" AND (o."factoryId"=${facilityId} OR o."shopId"=${facilityId})))`);
    if (kind === 'production' && options.statuses) filters.push(options.statuses.length ? Prisma.sql`o.status IN (${Prisma.join(options.statuses)})` : Prisma.sql`false`);
    const where = Prisma.join(filters, ' AND ');
    const groups = kind === 'production'
        ? Prisma.sql`SELECT o."factoryId" AS id,count(*)::integer AS count,${options.showAmounts === false ? Prisma.sql`count(*)::numeric` : Prisma.sql`SUM(o."totalAmount")`} AS value FROM "Order" o WHERE ${where} GROUP BY o."factoryId"`
        : Prisma.sql`SELECT COALESCE(t."createdBy",'') AS id,count(*)::integer AS count,SUM(t.amount) AS value FROM "Transaction" t WHERE ${where} GROUP BY t."createdBy"`;
    const page = cursor ? Prisma.sql`(g.value < ${cursor.value}::numeric OR (g.value=${cursor.value}::numeric AND g.id>${cursor.id}))` : Prisma.sql`true`;
    const name = kind === 'production' ? Prisma.sql`COALESCE(entity.name,'منشأة غير متاحة')` : Prisma.sql`CASE WHEN g.id='' THEN 'النظام' ELSE COALESCE(entity."displayName",g.id) END`;
    const join = kind === 'production' ? Prisma.sql`LEFT JOIN "Facility" entity ON entity.id=g.id` : Prisma.sql`LEFT JOIN "User" entity ON entity.id=g.id`;
    const rows = await client.$queryRaw<{ records: Prisma.JsonValue; topFactory: string | null }[]>(Prisma.sql`
        WITH grouped AS (${groups})
        SELECT (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',g.id,'name',${name},'count',g.count,'value',g.value::text) ORDER BY g.value DESC,g.id),'[]'::jsonb)
          FROM (SELECT * FROM grouped g WHERE ${page} ORDER BY g.value DESC,g.id LIMIT ${limit + 1}) g ${join}) AS records,
          (SELECT ${name} FROM grouped g ${join} ORDER BY g.value DESC,g.id LIMIT 1) AS "topFactory"
    `);
    const records = rows[0].records as unknown as RawGroup[];
    const hasMore = records.length > limit;
    const visible = hasMore ? records.slice(0, limit) : records;
    const last = visible.at(-1);
    return {
        type: kind,
        ...(kind === 'production' ? { summary: { topFactory: rows[0].topFactory ?? 'N/A' } } : {}),
        details: kind === 'production' ? visible.map(row => ({ id: row.id, name: row.name, count: row.count, ...(options.showAmounts === false ? {} : { value: toMoneyNumber(row.value) }) }))
            : visible.map(row => ({ id: row.id || 'System', name: row.name, transactionCount: row.count, volume: toMoneyNumber(row.value) })),
        nextCursor: hasMore && last ? encodeReportGroupCursor({ kind, id: last.id, value: last.value }) : null,
    };
}
