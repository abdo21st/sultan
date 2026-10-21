import { activateNotificationOwner, clearNotificationOwner, mergeLegacyNotifications, notificationRevision, notificationState, parseNotificationSnapshot, publishNotificationState } from './notification-client-state';
const row = { id: 'one', title: 'Synthetic', message: 'Test', link: '/orders/one', read: false, createdAt: '2026-10-21T00:00:00.000Z' };
beforeEach(() => { activateNotificationOwner(''); activateNotificationOwner('alice:0'); });
it('hides and rejects notification state from another account or revoked version', () => {
    publishNotificationState('alice:0', { notifications: [row], unreadCount: 1 });
    expect(notificationState('alice:0').notifications).toHaveLength(1);
    activateNotificationOwner('bob:0');
    expect(notificationState('bob:0').notifications).toEqual([]);
    expect(notificationState('alice:0').notifications).toEqual([]);
    publishNotificationState('alice:0', { notifications: [row], unreadCount: 1 });
    clearNotificationOwner('alice:0');
    expect(notificationState('bob:0').notifications).toEqual([]);
});
it('preserves a stable snapshot and supports the previous server message format', () => {
    const revision = notificationRevision('alice:0');
    mergeLegacyNotifications('alice:0', [row]); mergeLegacyNotifications('alice:0', [row]);
    expect(notificationState('alice:0').unreadCount).toBe(1);
    expect(notificationState('alice:0').notifications).toHaveLength(1);
    expect(notificationRevision('alice:0')).toBeGreaterThan(revision);
});
it('accepts only a bounded safe snapshot shape and drops surplus fields', () => {
    expect(parseNotificationSnapshot({ notifications: [{ ...row, password: 'not-forwarded' }], unreadCount: 1 })).toEqual({ notifications: [row], unreadCount: 1 });
    expect(parseNotificationSnapshot({ notifications: [row], unreadCount: -1 })).toBeNull();
    expect(parseNotificationSnapshot({ notifications: [{ ...row, message: {} }], unreadCount: 1 })).toBeNull();
    expect(parseNotificationSnapshot({ notifications: [{ ...row, createdAt: 'invalid' }], unreadCount: 1 })).toBeNull();
    publishNotificationState('alice:0', { notifications: Array.from({ length: 50 }, (_, index) => ({ ...row, id: String(index) })), unreadCount: 50 });
    expect(notificationState('alice:0').notifications).toHaveLength(20);
});
