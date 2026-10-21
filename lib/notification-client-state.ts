'use client';
import type { NotificationItem, NotificationSnapshot } from './notification-stream-types';
export const NOTIFICATION_REFRESH = 'sultan:notification-refresh';
export const EMPTY_NOTIFICATION_STATE = { notifications: [] as NotificationItem[], unreadCount: 0, loaded: false };
let owner = '';
let revision = 0;
let state = EMPTY_NOTIFICATION_STATE;
const listeners = new Set<() => void>();
export function subscribeNotificationState(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function activateNotificationOwner(key: string) {
    if (owner === key) return;
    owner = key; state = EMPTY_NOTIFICATION_STATE; revision++; listeners.forEach(listener => listener());
}
export function clearNotificationOwner(key: string) { if (owner === key) activateNotificationOwner(''); }
export function notificationRevision(key: string) { return owner === key ? revision : -1; }
export function notificationState(key: string) { return owner === key ? state : EMPTY_NOTIFICATION_STATE; }
export function publishNotificationState(key: string, snapshot: NotificationSnapshot) {
    if (!key || owner !== key) return;
    state = { ...snapshot, notifications: snapshot.notifications.slice(0, 20), loaded: true }; revision++;
    listeners.forEach(listener => listener());
}
export function parseNotificationItems(value: unknown): NotificationItem[] | null {
    if (!Array.isArray(value)) return null;
    const result: NotificationItem[] = [];
    for (const item of value) {
        if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.message !== 'string' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) || (item.link != null && typeof item.link !== 'string')) return null;
        result.push({ id: item.id, title: item.title, message: item.message, createdAt: item.createdAt, link: item.link ?? null, read: item.read === true });
    }
    return result;
}
export function parseNotificationSnapshot(value: unknown): NotificationSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as { notifications?: unknown; unreadCount?: unknown };
    const notifications = parseNotificationItems(record.notifications);
    if (!notifications || !Number.isSafeInteger(record.unreadCount) || Number(record.unreadCount) < 0) return null;
    return { notifications, unreadCount: Number(record.unreadCount) };
}
export function mergeLegacyNotifications(key: string, incoming: NotificationItem[]) {
    if (owner !== key) return;
    const known = new Set(state.notifications.map(item => item.id));
    const added = incoming.filter(item => !known.has(item.id));
    publishNotificationState(key, { notifications: [...added, ...state.notifications], unreadCount: state.unreadCount + added.filter(item => !item.read).length });
}
