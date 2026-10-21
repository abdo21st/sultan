import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { SharedNotificationStream } from '../lib/shared-notification-stream';
import { createNotificationRepository } from '../lib/notification-stream-repository';
import { createStatusChangeNotification } from '../lib/services/notification-service';
import { prisma as serviceClient } from '../lib/prisma';
import { ORDER_STATUS } from '../lib/constants';
import { PERMISSIONS } from '../lib/permissions';
import type { NotificationStreamEvent } from '../lib/notification-stream-types';

const source = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const parsed = new URL(source);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !/^\/sultan_e2e_[a-z0-9_]+$/.test(parsed.pathname) || !process.env.E2E_STREAM_USER_ID) throw new Error('Use only a disposable E2E database and generated stream fixtures.');
const pool = new Pool({ connectionString: source, max: 4 });
const client = new PrismaClient({ adapter: new PrismaPg(pool), log: [{ emit: 'event', level: 'query' }] });
let queries = 0;
let notificationSql: { query: string; params: string } | undefined;
client.$on('query', event => { queries++; if (event.query.includes('WITH requested')) notificationSql = event; });
const suffix = randomBytes(6).toString('hex');
let stage = 'initialization';
let server: ChildProcess | undefined;
const assert: (value: unknown, message: string) => asserts value = (value, message) => { if (!value) throw new Error(message); };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const actor = await client.user.findUniqueOrThrow({ where: { id: process.env.E2E_STREAM_USER_ID }, select: { id: true, sessionVersion: true, facilityId: true, password: true } });
    const other = await client.user.findUniqueOrThrow({ where: { id: process.env.E2E_STREAM_OUTSIDE_USER_ID }, select: { id: true, sessionVersion: true, facilityId: true } });
    const order = await client.order.findUniqueOrThrow({ where: { id: process.env.E2E_OWN_ORDER_ID }, select: { id: true, serialNumber: true, factoryId: true, shopId: true } });
    stage = 'effective notification recipients';
    const delegated = await client.user.create({ data: { username: `notification_delegate_${suffix}`, displayName: 'Synthetic delegated observer', password: actor.password, role: 'USER', facilityId: order.factoryId, permissions: [PERMISSIONS.STATUS_VIEW_PROCESSING] }, select: { id: true } });
    const before = await client.notification.findMany({ select: { id: true } });
    await createStatusChangeNotification(order, ORDER_STATUS.DELIVERING_TO_FACTORY);
    const generated = await client.notification.findMany({ where: { id: { notIn: before.map(row => row.id) } }, select: { userId: true } });
    assert(generated.length === 2 && generated.some(row => row.userId === actor.id) && generated.some(row => row.userId === delegated.id) && !generated.some(row => row.userId === other.id), 'Default and delegated recipient scope failed.');
    console.log(JSON.stringify({ notificationRecipients: { defaultRole: true, delegatedPermission: true, otherFacilityExcluded: true } }));

    stage = 'shared notification database queries';
    const repository = createNotificationRepository(client);
    const probe = await repository.readPages([{ userId: actor.id, cursor: null }, { userId: other.id, cursor: null }]);
    assert(probe.length === 2 && probe.every(page => page.databaseNow instanceof Date), 'Notification page SQL or timestamps failed.');
    const broker = new SharedNotificationStream(repository, { autoStart: false });
    const received: { userId: string; messages: string[]; visibleIds: string[]; lastUnread: number; closed: boolean }[] = [];
    const unsubscribe: (() => void)[] = [];
    function addWindow(user: typeof actor | typeof other) {
        const state = { userId: user.id, messages: [] as string[], visibleIds: [] as string[], lastUnread: 0, closed: false }; received.push(state);
        unsubscribe.push(broker.subscribe(user, (event: NotificationStreamEvent) => {
            if (event.kind === 'notifications') state.messages.push(...event.value.map(item => item.id));
            if (event.kind === 'state') { state.lastUnread = event.value.unreadCount; state.visibleIds = event.value.notifications.map(item => item.id); }
        }, () => { state.closed = true; }));
    }
    for (let index = 0; index < 100; index++) addWindow(index % 5 ? actor : other);
    queries = 0; await broker.pollOnce(); const oneHundred = queries;
    assert(oneHundred === 2 && received.every(state => !state.closed), 'One hundred windows did not share two successful queries.');
    for (let index = 100; index < 500; index++) addWindow(index % 5 ? actor : other);
    queries = 0; await broker.pollOnce(); const fiveHundred = queries;
    assert(fiveHundred === 2, 'Five hundred windows increased periodic database query count.');
    const now = new Date(Math.max(Date.now(), ...probe.map(page => page.databaseNow.getTime()), ...probe.flatMap(page => page.notifications.map(item => Date.parse(item.createdAt)))) + 1);
    const idA = `notification_${suffix}_a`; const idB = `notification_${suffix}_b`;
    await client.notification.createMany({ data: [{ id: idA, userId: actor.id, title: 'Synthetic A', message: 'Private A', createdAt: now }, { id: idB, userId: other.id, title: 'Synthetic B', message: 'Private B', createdAt: now }] });
    await broker.pollOnce();
    assert(received.every(state => state.messages.length === 1 && state.messages[0] === (state.userId === actor.id ? idA : idB)), 'Notification fanout crossed user scope.');
    const ownership = new Map((await client.notification.findMany({ select: { id: true, userId: true } })).map(item => [item.id, item.userId]));
    assert(received.every(state => state.visibleIds.every(id => ownership.get(id) === state.userId)), 'Notification state exposed another user.');
    const backlogDate = new Date(now.getTime() + 1);
    await client.notification.createMany({ data: Array.from({ length: 45 }, (_, index) => ({ id: `notification_${suffix}_${String(index).padStart(3, '0')}`, userId: actor.id, title: 'Synthetic backlog', message: 'Test', createdAt: backlogDate })) });
    for (let index = 0; index < 3; index++) await broker.pollOnce();
    assert(received.every(state => state.messages.length === (state.userId === actor.id ? 46 : 1) && new Set(state.messages).size === state.messages.length), 'Equal timestamp cursor lost or repeated backlog records.');
    const previousUnread = received.find(state => state.userId === actor.id)!.lastUnread;
    await client.notification.update({ where: { id: idA }, data: { read: true } }); await broker.pollOnce();
    assert(received.filter(state => state.userId === actor.id).every(state => state.lastUnread === previousUnread - 1), 'Read state did not fan out.');
    await client.user.update({ where: { id: actor.id }, data: { sessionVersion: { increment: 1 } } }); await broker.pollOnce();
    assert(received.filter(state => state.userId === actor.id).every(state => state.closed) && received.filter(state => state.userId === other.id).every(state => !state.closed), 'Session revocation affected the wrong subscribers.');
    unsubscribe.forEach(close => close());
    console.log(JSON.stringify({ sharedNotificationQueries: { uniqueUsers: 2, windows100: oneHundred, windows500: fiveHundred, sameTimestampBacklog: 45, duplicateMessages: 0, readStateShared: true, revokedUserClosed: true } }));

    stage = 'notification index plan';
    for (let batch = 0; batch < 10; batch++) await client.notification.createMany({ data: Array.from({ length: 1000 }, (_, index) => ({ id: `history_${suffix}_${batch}_${index}`, userId: index % 2 ? actor.id : other.id, title: 'Read historical fixture', message: 'Synthetic history', read: true, createdAt: new Date('2025-01-01T00:00:00Z') })) });
    await client.$executeRaw`ANALYZE "Notification"`;
    await repository.readPages([{ userId: actor.id, cursor: { date: now, id: '' } }, { userId: other.id, cursor: { date: now, id: '' } }]);
    assert(notificationSql, 'The notification query was not captured.');
    const plan = (await pool.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${notificationSql.query}`, JSON.parse(notificationSql.params))).rows[0]['QUERY PLAN'];
    const planText = JSON.stringify(plan);
    assert(planText.includes('Notification_userId_read_createdAt_id_idx'), 'The bounded notification query did not use its composite index.');
    console.log(JSON.stringify({ notificationIndexAcceptance: { historicalReadRows: 10000, compositeIndexUsed: true } }));

    stage = 'distinct user batching';
    const streamActors = Array.from({ length: 501 }, (_, index) => ({ id: `stream_batch_${suffix}_${String(index).padStart(3, '0')}`, username: `stream_batch_${suffix}_${index}`, displayName: 'Synthetic batch actor', password: actor.password, role: 'USER' as const }));
    await client.user.createMany({ data: streamActors });
    const batchBroker = new SharedNotificationStream(repository, { autoStart: false });
    const batchStops: (() => void)[] = []; let batchStates = 0; let batchClosed = 0;
    const connectBatchActor = (id: string) => batchStops.push(batchBroker.subscribe({ id, sessionVersion: 0 }, event => { if (event.kind === 'state') batchStates++; }, () => { batchClosed++; }));
    streamActors.slice(0, 500).forEach(user => connectBatchActor(user.id));
    queries = 0; await batchBroker.pollOnce(); const users500 = queries;
    assert(users500 === 2 && batchStates === 500 && batchClosed === 0, 'Five hundred distinct users did not share one bounded query batch.');
    connectBatchActor(streamActors[500].id); queries = 0; await batchBroker.pollOnce(); const users501 = queries;
    assert(users501 === 4 && Number(batchStates) === 501 && batchClosed === 0, 'The user batch boundary failed.'); batchStops.forEach(stop => stop());
    console.log(JSON.stringify({ notificationUserBatching: { distinct500UsersQueries: users500, distinct501UsersQueries: users501, batchSize: 500, simulatedSubscriptions: true, networkLoadTest: false } }));

    stage = 'paged API scale fixtures';
    const factories = Array.from({ length: 60 }, (_, index) => ({ id: `perf_factory_${suffix}_${String(index).padStart(3, '0')}`, name: `Synthetic performance factory ${suffix} ${index}`, type: 'FACTORY' }));
    const users = factories.map((factory, index) => ({ id: `perf_actor_${suffix}_${String(index).padStart(3, '0')}`, username: `perf_actor_${suffix}_${index}`, displayName: `Synthetic actor ${String(index).padStart(3, '0')}`, password: actor.password, role: 'USER' as const, mustChangePassword: true, facilityId: factory.id }));
    await client.facility.createMany({ data: factories }); await client.user.createMany({ data: users });
    async function seed(first: number, end: number) {
        for (let offset = first; offset < end; offset += 500) {
            const indices = Array.from({ length: Math.min(500, end - offset) }, (_, index) => offset + index);
            const date = (index: number) => { const current = new Date(); return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - index % 6, 1)); };
            await client.order.createMany({ data: indices.map(index => ({ id: `perf_order_${suffix}_${String(index).padStart(5, '0')}`, customerName: `Synthetic customer ${String(index).padStart(5, '0')}`, customerPhone: '0910000999', description: 'Synthetic performance only', factoryId: factories[index % 60].id, shopId: order.shopId, totalAmount: 100, paidAmount: 0, remainingAmount: 100, dueDate: new Date(Date.now() + 30 * 86400000), createdAt: date(index), images: [] })) });
            await client.transaction.createMany({ data: indices.map(index => ({ id: `perf_transaction_${suffix}_${String(index).padStart(5, '0')}`, type: 'EXPENSE', amount: 1, category: 'OTHER', description: 'Synthetic performance only', facilityId: factories[index % 60].id, createdBy: users[index % 60].id, date: date(index) })) });
        }
        await client.$executeRaw`ANALYZE "Order"`; await client.$executeRaw`ANALYZE "Transaction"`;
    }
    const listener = createServer();
    await new Promise<void>((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
    const port = (listener.address() as { port: number }).port; await new Promise<void>(resolve => listener.close(() => resolve()));
    const base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.resolve('.next/standalone/server.js')], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', AUTH_URL: base, NEXTAUTH_URL: base, AUTH_TRUST_HOST: 'true' }, stdio: 'ignore', windowsHide: true });
    let healthy = false;
    for (let attempt = 0; attempt < 60; attempt++) { try { if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) { healthy = true; break; } } catch { /* Standalone runtime starts asynchronously. */ } await pause(500); }
    assert(healthy, 'The isolated scale runtime failed health.');
    const cookies = new Map<string, string>(); const factoryCookies = new Map<string, string>();
    async function request(uri: string, options: RequestInit = {}, jar = cookies) {
        const response = await fetch(`${base}${uri}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { ...options.headers, Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; ') } });
        for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';', 1)[0]; const index = pair.indexOf('='); jar.set(pair.slice(0, index), pair.slice(index + 1)); }
        return response;
    }
    const { csrfToken } = await (await request('/api/auth/csrf')).json();
    await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken, username: process.env.E2E_ADMIN_USERNAME!, password: process.env.E2E_ADMIN_PASSWORD!, json: 'true' }) });
    assert((await (await request('/api/auth/session')).json()).user?.role === 'ADMIN', 'Scale fixture administrator could not authenticate.');
    const factoryCsrf = await (await request('/api/auth/csrf', {}, factoryCookies)).json();
    await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: factoryCsrf.csrfToken, username: process.env.E2E_STREAM_USERNAME!, password: process.env.E2E_STREAM_PASSWORD!, json: 'true' }) }, factoryCookies);
    assert((await (await request('/api/auth/session', {}, factoryCookies)).json()).user?.id === actor.id, 'Assigned factory actor could not authenticate after revocation.');
    const urls = ['/api/orders?limit=25', '/api/transactions?limit=25', '/api/admin/reports?type=financial&limit=25', '/api/admin/reports?type=operational&limit=25', '/api/admin/reports?type=production&limit=25', '/api/admin/reports?type=users&limit=25', '/api/admin/analytics'];
    const targets = [...urls.map(url => ({ url, scope: 'admin' as const })), ...urls.slice(0, 2).map(url => ({ url, scope: 'assigned-factory' as const }))];
    type Measurement = { url: string; scope: string; medianMs: number; p95Ms: number; bytes: number; rows: number };
    async function measure(): Promise<Measurement[]> {
        const results: Measurement[] = [];
        for (const { url, scope } of targets) {
            const times: number[] = []; let bytes = 0; let rows = 0;
            for (let index = 0; index < 9; index++) {
                const start = performance.now(); const response = await request(url, {}, scope === 'admin' ? cookies : factoryCookies); const text = await response.text();
                assert(response.ok, `Scale API failed: ${url}`);
                const body = JSON.parse(text);
                rows = Array.isArray(body) ? body.length : (body.transactions ?? body.details ?? body.monthlySales).length;
                if (scope === 'assigned-factory') assert((Array.isArray(body) ? body : body.transactions).every((row: { id: string }) => !row.id.startsWith('perf_')), 'Assigned factory pagination leaked unrelated performance records.');
                assert(rows <= (url.endsWith('/analytics') ? 7 : 25), 'A list exceeded its bounded page size.');
                if (index >= 2) times.push(performance.now() - start);
                bytes = Buffer.byteLength(text);
            }
            times.sort((left, right) => left - right);
            results.push({ url, scope, medianMs: Number(times[3].toFixed(2)), p95Ms: Number(times[6].toFixed(2)), bytes, rows });
        }
        return results;
    }
    await seed(0, 1000); stage = 'one thousand record API measurement'; const small = await measure();
    await seed(1000, 10000); stage = 'ten thousand record API measurement'; const large = await measure();
    for (let index = 0; index < small.length; index++) {
        assert(large[index].bytes <= small[index].bytes * 1.1 + 100, 'Paged response size grew with total row count.');
        assert(large[index].medianMs <= small[index].medianMs * 2.5 + 10, 'Median list time materially regressed with tenfold fixture growth.');
    }
    stage = 'group report traversal and reconciliation';
    for (const type of ['production', 'users']) {
        const records: { id: string; count?: number; value?: number; transactionCount?: number; volume?: number }[] = []; let cursor: string | null = null; let count = 0;
        do {
            const response = await request(`/api/admin/reports?type=${type}&limit=7${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
            assert(response.ok, 'Grouped report pagination failed.'); const body = await response.json();
            assert(body.details.length <= 7, 'Grouped report page size exceeded seven.'); records.push(...body.details); cursor = body.nextCursor;
            assert(++count < 100, 'Grouped report pagination did not terminate.');
        } while (cursor);
        const expected = type === 'production' ? (await client.order.groupBy({ by: ['factoryId'] })).map(row => row.factoryId) : (await client.transaction.groupBy({ by: ['createdBy'] })).map(row => row.createdBy ?? 'System');
        assert(records.length === expected.length && new Set(records.map(row => row.id)).size === expected.length && records.every(row => expected.includes(row.id)), 'Grouped report traversal lost or repeated groups.');
        if (type === 'production') {
            const groups = await client.order.groupBy({ by: ['factoryId'], _count: { _all: true }, _sum: { totalAmount: true } });
            assert(groups.every(group => records.some(record => record.id === group.factoryId && record.count === group._count._all && record.value === Number(group._sum.totalAmount))), 'Paged production totals differ from the ledger.');
        } else {
            const groups = await client.transaction.groupBy({ by: ['createdBy'], _count: { _all: true }, _sum: { amount: true } });
            assert(groups.every(group => records.some(record => record.id === (group.createdBy ?? 'System') && record.transactionCount === group._count._all && record.volume === Number(group._sum.amount))), 'Paged user totals differ from the ledger.');
        }
    }
    const mismatches = await client.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "Order" o WHERE o."paidAmount"<>COALESCE((SELECT sum(amount) FROM "Transaction" t WHERE t."orderId"=o.id AND t.type='INCOME'),0)`;
    assert(Number(mismatches[0].count) === 0, 'Synthetic performance fixtures changed ledger consistency.');
    console.log(JSON.stringify({ pagedApiGrowthAcceptance: { syntheticData: true, productionDataUsed: false, extraOrders: [1000, 10000], extraTransactions: [1000, 10000], small, large, groupedTraversalComplete: true, ledgerMismatches: 0, timingRule: 'median_large <= median_small * 2.5 + 10ms; controlled serial local requests, not a concurrent load test' } }));
}

main().catch((error: unknown) => {
    const value = error as { code?: string; name?: string; meta?: { message?: string } };
    console.error(JSON.stringify({ performanceAcceptanceFailedAt: stage, code: value.code || value.name, reason: value.meta?.message })); process.exitCode = 1;
}).finally(async () => {
    if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise(resolve => server!.once('close', resolve)), pause(5000)]); if (server.exitCode === null) server.kill('SIGKILL'); }
    await client.$disconnect(); await pool.end().catch(() => undefined); await serviceClient.$disconnect();
    await (globalThis as typeof globalThis & { pool?: Pool }).pool?.end().catch(() => undefined);
});
