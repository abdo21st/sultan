/** @jest-environment node */
import { SharedNotificationStream } from './shared-notification-stream';
import type { NotificationItem, NotificationPage, NotificationPageRequest, NotificationRepository, NotificationStreamEvent } from './notification-stream-types';

const item = (id: string, read = false): NotificationItem => ({ id, read, title: 'Synthetic notification', message: 'Test only', link: '/orders/test', createdAt: '2026-10-21T00:00:01.000Z' });
function fixture() {
    const users = [{ id: 'a', sessionVersion: 0, mustChangePassword: false }, { id: 'b', sessionVersion: 0, mustChangePassword: false }];
    const repository = {
        loadUsers: jest.fn(async () => users),
        readPages: jest.fn(async (requests: NotificationPageRequest[]): Promise<NotificationPage[]> => requests.map(request => ({ userId: request.userId, databaseNow: new Date('2026-10-21T00:00:00.000Z'), notifications: [], newNotifications: [], unreadCount: 0 }))),
    } satisfies NotificationRepository;
    const broker = new SharedNotificationStream(repository, { autoStart: false });
    return { users, repository, broker };
}

it('groups one hundred windows into two users and does not replay old notifications', async () => {
    const { repository, broker } = fixture();
    const send = jest.fn();
    repository.readPages.mockImplementation(async requests => requests.map(request => ({ userId: request.userId, databaseNow: new Date(), notifications: [item(`old-${request.userId}`)], newNotifications: [], unreadCount: 1 })));
    for (let index = 0; index < 100; index++) broker.subscribe({ id: index < 80 ? 'a' : 'b', sessionVersion: 0 }, send, jest.fn());
    await broker.pollOnce();
    expect(repository.loadUsers).toHaveBeenCalledWith(['a', 'b']);
    expect(repository.readPages.mock.calls[0][0]).toHaveLength(2);
    await broker.pollOnce();
    expect(repository.loadUsers).toHaveBeenCalledTimes(2);
    expect(repository.readPages).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.filter(([event]) => event.kind === 'notifications')).toHaveLength(0);
});

it('routes data only to its user, advances the shared cursor, and updates read state', async () => {
    const { repository, broker } = fixture();
    const events = { a: [] as NotificationStreamEvent[], otherA: [] as NotificationStreamEvent[], b: [] as NotificationStreamEvent[] };
    for (const [name, user] of [['a', 'a'], ['otherA', 'a'], ['b', 'b']] as const) broker.subscribe({ id: user, sessionVersion: 0 }, event => events[name].push(event), jest.fn());
    await broker.pollOnce();
    repository.readPages.mockImplementation(async requests => requests.map(request => ({ userId: request.userId, databaseNow: new Date(), notifications: [item(request.userId)], newNotifications: [item(request.userId)], unreadCount: 1 })));
    await broker.pollOnce();
    expect(events.a.filter(event => event.kind === 'notifications')).toEqual([{ kind: 'notifications', value: [item('a')] }]);
    expect(events.otherA).toEqual(events.a);
    expect(events.b.filter(event => event.kind === 'notifications')).toEqual([{ kind: 'notifications', value: [item('b')] }]);
    expect(repository.readPages.mock.calls.at(-1)![0][0].cursor).toEqual({ id: '', date: new Date('2026-10-21T00:00:00.000Z') });
    repository.readPages.mockImplementation(async requests => requests.map(request => ({ userId: request.userId, databaseNow: new Date(), notifications: [item(request.userId, true)], newNotifications: [], unreadCount: 0 })));
    await broker.pollOnce();
    expect(repository.readPages.mock.calls.at(-1)![0][0].cursor?.id).toBe('a');
    expect(events.a.filter(event => event.kind === 'notifications')).toHaveLength(1);
    expect(events.a.filter(event => event.kind === 'state').at(-1)).toEqual({ kind: 'state', value: { notifications: [item('a', true)], unreadCount: 0 } });
});

it.each(['revoked', 'initial', 'deleted'] as const)('closes %s accounts before fetching or sending their data', async reason => {
    const { users, repository, broker } = fixture();
    const closeA = jest.fn(); const closeB = jest.fn();
    broker.subscribe({ id: 'a', sessionVersion: 0 }, jest.fn(), closeA);
    broker.subscribe({ id: 'b', sessionVersion: 0 }, jest.fn(), closeB);
    await broker.pollOnce();
    if (reason === 'revoked') users[0].sessionVersion++;
    if (reason === 'initial') users[0].mustChangePassword = true;
    if (reason === 'deleted') users.splice(0, 1);
    await broker.pollOnce();
    expect(closeA).toHaveBeenCalledTimes(1); expect(closeB).not.toHaveBeenCalled();
    expect(repository.readPages.mock.calls.at(-1)![0].map(request => request.userId)).toEqual(['b']);
});

it('does not overlap database polls and ignores an old generation after reconnection', async () => {
    const { repository, broker } = fixture();
    let resolve!: (value: Awaited<ReturnType<NotificationRepository['loadUsers']>>) => void;
    repository.loadUsers.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const old = jest.fn(); const fresh = jest.fn();
    const unsubscribe = broker.subscribe({ id: 'a', sessionVersion: 0 }, old, jest.fn());
    const first = broker.pollOnce();
    expect(broker.pollOnce()).toBe(first);
    unsubscribe(); broker.subscribe({ id: 'a', sessionVersion: 0 }, fresh, jest.fn());
    resolve([{ id: 'a', sessionVersion: 0, mustChangePassword: false }]); await first;
    expect(old).not.toHaveBeenCalled(); expect(fresh).not.toHaveBeenCalled();
    await broker.pollOnce(); expect(fresh).toHaveBeenCalled();
});

it('fails closed on database failure and contains a broken transport', async () => {
    const { repository, broker } = fixture(); const closeA = jest.fn(); const closeB = jest.fn();
    broker.subscribe({ id: 'a', sessionVersion: 0 }, () => { throw new Error('Disconnected'); }, closeA);
    broker.subscribe({ id: 'b', sessionVersion: 0 }, jest.fn(), closeB);
    await broker.pollOnce(); expect(closeA).toHaveBeenCalledTimes(1); expect(closeB).not.toHaveBeenCalled();
    repository.loadUsers.mockRejectedValueOnce(new Error('Unavailable'));
    await broker.pollOnce(); expect(closeB).toHaveBeenCalledTimes(1);
});

it('keeps a new session open when older sessions of the same user are revoked', async () => {
    const { users, repository, broker } = fixture();
    users[0].sessionVersion = 1;
    const oldClose = jest.fn(); const freshClose = jest.fn();
    broker.subscribe({ id: 'a', sessionVersion: 0 }, jest.fn(), oldClose);
    broker.subscribe({ id: 'a', sessionVersion: 1 }, jest.fn(), freshClose);
    await broker.pollOnce();
    expect(oldClose).toHaveBeenCalledTimes(1); expect(freshClose).not.toHaveBeenCalled();
    expect(repository.readPages.mock.calls[0][0].map(request => request.userId)).toEqual(['a']);
});
