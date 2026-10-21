import type { NotificationCursor, NotificationPrincipal, NotificationRepository, NotificationSnapshot, NotificationStreamEvent } from './notification-stream-types';
type Subscriber = { principal: NotificationPrincipal; send(event: NotificationStreamEvent): void; close(): void; closed: boolean };
type Group = { userId: string; cursor: NotificationCursor | null; subscribers: Set<Subscriber>; snapshot?: NotificationSnapshot; snapshotKey?: string };

/** One polling loop per application process and one cursor per active user. */
export class SharedNotificationStream {
    private readonly groups = new Map<string, Group>();
    private timer?: ReturnType<typeof setInterval>;
    private kick?: ReturnType<typeof setTimeout>;
    private polling?: Promise<void>;
    private followup = false;
    constructor(private readonly repository: NotificationRepository, private readonly options: { autoStart?: boolean; intervalMs?: number } = {}) {}

    subscribe(principal: NotificationPrincipal, send: Subscriber['send'], close: Subscriber['close']): () => void {
        if (!principal.id || !Number.isSafeInteger(principal.sessionVersion) || principal.sessionVersion < 0) throw new Error('Invalid notification principal.');
        let group = this.groups.get(principal.id);
        const isNew = !group;
        if (!group) { group = { userId: principal.id, cursor: null, subscribers: new Set() }; this.groups.set(principal.id, group); }
        const subscriber: Subscriber = { principal: { id: principal.id, sessionVersion: principal.sessionVersion }, send, close, closed: false };
        group.subscribers.add(subscriber);
        if (group.snapshot) this.send(group, subscriber, { kind: 'state', value: group.snapshot });
        if (!subscriber.closed && this.options.autoStart !== false) {
            this.timer ??= setInterval(() => { void this.pollOnce(); }, this.options.intervalMs ?? 15_000);
            if (isNew) this.schedule();
        }
        return () => this.remove(group!, subscriber, false);
    }
    private schedule() {
        if (this.polling) { this.followup = true; return; }
        if (this.kick || this.groups.size === 0) return;
        this.kick = setTimeout(() => { this.kick = undefined; void this.pollOnce(); }, 0);
    }
    private remove(group: Group, subscriber: Subscriber, close: boolean) {
        if (subscriber.closed) return;
        subscriber.closed = true; group.subscribers.delete(subscriber);
        if (group.subscribers.size === 0 && this.groups.get(group.userId) === group) this.groups.delete(group.userId);
        if (this.groups.size === 0) {
            clearInterval(this.timer); this.timer = undefined; clearTimeout(this.kick); this.kick = undefined; this.followup = false;
        }
        if (close) { try { subscriber.close(); } catch { /* Transport already disconnected. */ } }
    }
    private send(group: Group, subscriber: Subscriber, event: NotificationStreamEvent) {
        if (subscriber.closed) return;
        try { subscriber.send(event); } catch { this.remove(group, subscriber, true); }
    }
    pollOnce(): Promise<void> {
        if (this.polling) return this.polling;
        this.polling = this.runPoll().finally(() => {
            this.polling = undefined;
            if (this.followup && this.groups.size > 0 && this.options.autoStart !== false) { this.followup = false; this.schedule(); }
        });
        return this.polling;
    }
    private async runPoll() {
        const groups = [...this.groups.values()];
        if (groups.length === 0) return;
        try {
            const users = new Map((await this.repository.loadUsers(groups.map(group => group.userId))).map(user => [user.id, user]));
            for (const group of groups) {
                if (this.groups.get(group.userId) !== group) continue;
                const current = users.get(group.userId);
                for (const subscriber of [...group.subscribers]) if (!current || current.mustChangePassword || current.sessionVersion !== subscriber.principal.sessionVersion) this.remove(group, subscriber, true);
            }
            const active = groups.filter(group => this.groups.get(group.userId) === group && group.subscribers.size > 0);
            if (active.length === 0) return;
            const pages = await this.repository.readPages(active.map(group => ({ userId: group.userId, cursor: group.cursor })));
            const lookup = new Map(active.map(group => [group.userId, group]));
            if (pages.length !== active.length || new Set(pages.map(page => page.userId)).size !== active.length || pages.some(page => !lookup.has(page.userId))) throw new Error('Invalid notification batch.');
            for (const page of pages) {
                const group = lookup.get(page.userId)!;
                if (this.groups.get(group.userId) !== group) continue;
                const notifications = group.cursor ? page.newNotifications : [];
                if (group.cursor === null) {
                    const newest = page.notifications[0];
                    group.cursor = newest ? { date: new Date(newest.createdAt), id: newest.id } : { date: page.databaseNow, id: '' };
                } else if (notifications.length > 0) {
                    const last = notifications[notifications.length - 1]; group.cursor = { date: new Date(last.createdAt), id: last.id };
                }
                const snapshot = { notifications: page.notifications, unreadCount: page.unreadCount };
                const key = JSON.stringify(snapshot); const changed = group.snapshotKey !== key;
                group.snapshot = snapshot; group.snapshotKey = key;
                for (const subscriber of [...group.subscribers]) {
                    if (changed) this.send(group, subscriber, { kind: 'state', value: snapshot });
                    if (notifications.length) this.send(group, subscriber, { kind: 'notifications', value: notifications });
                    this.send(group, subscriber, { kind: 'heartbeat' });
                }
            }
        } catch {
            // Authorization or database failures close streams; EventSource may reconnect.
            for (const group of [...this.groups.values()]) for (const subscriber of [...group.subscribers]) this.remove(group, subscriber, true);
        }
    }
}
