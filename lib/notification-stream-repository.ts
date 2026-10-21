import { Prisma, type PrismaClient } from '@prisma/client';
import type { NotificationItem, NotificationPage, NotificationRepository } from './notification-stream-types';
type RawPage = Omit<NotificationPage, 'notifications' | 'newNotifications'> & { notifications: Prisma.JsonValue; newNotifications: Prisma.JsonValue };
const BATCH_SIZE = 500;
function items(value: Prisma.JsonValue): NotificationItem[] {
    if (!Array.isArray(value)) throw new Error('Invalid notification records.');
    return value.map(raw => {
        if (!raw || Array.isArray(raw) || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.title !== 'string' || typeof raw.message !== 'string' || typeof raw.read !== 'boolean' || typeof raw.createdAt !== 'string' || (raw.link !== null && typeof raw.link !== 'string')) throw new Error('Invalid notification record.');
        return { id: raw.id, title: raw.title, message: raw.message, link: raw.link, read: raw.read, createdAt: new Date(raw.createdAt).toISOString() };
    });
}
export function createNotificationRepository(client: Pick<PrismaClient, 'user' | '$queryRaw'>): NotificationRepository {
    return {
        async loadUsers(ids) {
            const result = [];
            for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) result.push(...await client.user.findMany({ where: { id: { in: ids.slice(offset, offset + BATCH_SIZE) } }, select: { id: true, sessionVersion: true, mustChangePassword: true } }));
            return result;
        },
        async readPages(requests) {
            const result: NotificationPage[] = [];
            for (let offset = 0; offset < requests.length; offset += BATCH_SIZE) {
                const values = requests.slice(offset, offset + BATCH_SIZE).map(request => Prisma.sql`(${request.userId}::text, ${request.cursor?.date ?? null}::timestamp(3), ${request.cursor?.id ?? null}::text)`);
                const rows = await client.$queryRaw<RawPage[]>(Prisma.sql`
                    WITH requested("userId", "afterDate", "afterId") AS (VALUES ${Prisma.join(values)})
                    SELECT r."userId", (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::timestamp(3) AS "databaseNow",
                      (SELECT count(*)::integer FROM "Notification" c WHERE c."userId"=r."userId" AND c.read=false) AS "unreadCount",
                      COALESCE(latest.items, '[]'::jsonb) AS notifications, COALESCE(fresh.items, '[]'::jsonb) AS "newNotifications"
                    FROM requested r
                    LEFT JOIN LATERAL (
                      SELECT jsonb_agg(to_jsonb(n) ORDER BY n."createdAt" DESC, n.id DESC) AS items FROM (
                        SELECT * FROM (
                          (SELECT n.id,n.title,n.message,n.link,n.read,to_char(n."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt" FROM "Notification" n WHERE n."userId"=r."userId" AND n.read=false ORDER BY n."createdAt" DESC,n.id DESC LIMIT 20)
                          UNION ALL
                          (SELECT n.id,n.title,n.message,n.link,n.read,to_char(n."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt" FROM "Notification" n WHERE n."userId"=r."userId" AND n.read=true ORDER BY n."createdAt" DESC,n.id DESC LIMIT 20)
                        ) merged ORDER BY "createdAt" DESC,id DESC LIMIT 20
                      ) n
                    ) latest ON true
                    LEFT JOIN LATERAL (
                      SELECT jsonb_agg(to_jsonb(n) ORDER BY n."createdAt",n.id) AS items FROM (
                        SELECT n.id,n.title,n.message,n.link,n.read,to_char(n."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt" FROM "Notification" n
                        WHERE r."afterDate" IS NOT NULL AND n."userId"=r."userId" AND n.read=false AND (n."createdAt",n.id)>(r."afterDate",r."afterId") ORDER BY n."createdAt",n.id LIMIT 20
                      ) n
                    ) fresh ON true
                `);
                result.push(...rows.map(row => ({ ...row, notifications: items(row.notifications), newNotifications: items(row.newNotifications) })));
            }
            return result;
        },
    };
}
