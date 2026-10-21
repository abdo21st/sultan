export type NotificationItem = { id: string; title: string; message: string; link: string | null; read: boolean; createdAt: string };
export type NotificationSnapshot = { notifications: NotificationItem[]; unreadCount: number };
export type NotificationCursor = { date: Date; id: string };
export type NotificationPage = NotificationSnapshot & { userId: string; databaseNow: Date; newNotifications: NotificationItem[] };
export type NotificationPrincipal = { id: string; sessionVersion: number };
export type NotificationAuth = NotificationPrincipal & { mustChangePassword: boolean };
export type NotificationPageRequest = { userId: string; cursor: NotificationCursor | null };
export type NotificationStreamEvent = { kind: 'state'; value: NotificationSnapshot } | { kind: 'notifications'; value: NotificationItem[] } | { kind: 'heartbeat' };
export interface NotificationRepository {
    loadUsers(ids: string[]): Promise<NotificationAuth[]>;
    readPages(requests: NotificationPageRequest[]): Promise<NotificationPage[]>;
}
