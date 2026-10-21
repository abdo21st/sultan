/** @jest-environment node */
jest.mock('@/lib/request-user', () => ({ getRequestUser: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notification: { findFirst: jest.fn(), findMany: jest.fn() },
    $queryRaw: jest.fn(),
} }));

import { prisma } from '@/lib/prisma';
import { getRequestUser } from '@/lib/request-user';
import { GET } from './route';

function configure() {
    jest.clearAllMocks();
    const user = { id: 'stream-user', sessionVersion: 0, mustChangePassword: false };
    (getRequestUser as jest.Mock).mockResolvedValue(user);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ userId: user.id, databaseNow: new Date(), notifications: [], newNotifications: [], unreadCount: 0 }]);
}

it('rejects an unauthenticated stream without starting the poller', async () => {
    configure(); (getRequestUser as jest.Mock).mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/api/notifications/stream'))).status).toBe(401);
    expect(prisma.user.findMany).not.toHaveBeenCalled(); expect(prisma.$queryRaw).not.toHaveBeenCalled();
});

it('does not subscribe an already aborted request', async () => {
    configure(); const abort = new AbortController(); abort.abort();
    const response = await GET(new Request('http://localhost/api/notifications/stream', { signal: abort.signal }));
    expect(await response.text()).toBe(''); expect(prisma.$queryRaw).not.toHaveBeenCalled();
});

it('bounds the buffer and stops polling when a client never consumes it', async () => {
    jest.useFakeTimers(); configure();
    try {
        const response = await GET(new Request('http://localhost/api/notifications/stream'));
        await jest.advanceTimersByTimeAsync(120_000);
        expect(jest.getTimerCount()).toBe(0);
        expect((await response.text()).length).toBeLessThan(1000);
    } finally { jest.clearAllTimers(); jest.useRealTimers(); }
});

it('shares periodic database reads across sixteen open windows', async () => {
    jest.useFakeTimers();
    const user = { id: 'stream-user', sessionVersion: 0, mustChangePassword: false };
    (getRequestUser as jest.Mock).mockResolvedValue(user);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([user]);
    (prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 'existing', createdAt: new Date() });
    (prisma.notification.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ userId: user.id, databaseNow: new Date(), notifications: [], newNotifications: [], unreadCount: 0 }]);
    const controllers: AbortController[] = [];
    const consumers: Promise<void>[] = [];
    try {
        for (let index = 0; index < 16; index++) {
            const controller = new AbortController(); controllers.push(controller);
            const response = await GET(new Request('http://localhost/api/notifications/stream', { signal: controller.signal }));
            expect(response.status).toBe(200);
            const reader = response.body!.getReader();
            consumers.push((async () => { while (!(await reader.read()).done) { /* Drain the live stream. */ } })());
        }
        await jest.advanceTimersByTimeAsync(1);
        jest.clearAllMocks();
        await jest.advanceTimersByTimeAsync(15_000);
        const reads = [prisma.user.findUnique, prisma.user.findMany, prisma.notification.findFirst, prisma.notification.findMany, prisma.$queryRaw]
            .reduce((count, operation) => count + (operation as jest.Mock).mock.calls.length, 0);
        expect(reads).toBe(2);
    } finally {
        controllers.forEach(controller => controller.abort());
        await Promise.all(consumers);
        expect(jest.getTimerCount()).toBe(0);
        jest.clearAllTimers(); jest.useRealTimers();
    }
});
