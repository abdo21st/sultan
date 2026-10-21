'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { Bell, BellOff, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import Modal from './Modal';
import { useSession } from 'next-auth/react';
import { activateNotificationOwner, EMPTY_NOTIFICATION_STATE, notificationRevision, notificationState, NOTIFICATION_REFRESH, parseNotificationSnapshot, publishNotificationState, subscribeNotificationState } from '@/lib/notification-client-state';

export default function Notifications() {
    const { data: session } = useSession();
    const owner = session?.user && !session.user.mustChangePassword ? `${session.user.id}:${session.user.sessionVersion}` : '';
    const { notifications, unreadCount } = useSyncExternalStore(subscribeNotificationState, () => notificationState(owner), () => EMPTY_NOTIFICATION_STATE);
    const [isOpen, setIsOpen] = useState(false);
    const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('notifications_enabled');
            return saved !== null ? saved === 'true' : true;
        }
        return true; // Default for SSR or initial render
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Use Promise to defer setMounted and avoid cascading render lint error
        Promise.resolve().then(() => setMounted(true));
    }, []);

    useEffect(() => {
        if (!mounted || !owner) return;
        activateNotificationOwner(owner);
        let active = true;

        const loadNotifications = async () => {
            const revision = notificationRevision(owner);
            try {
                const res = await fetch('/api/notifications');
                if (res.ok) {
                    const snapshot = parseNotificationSnapshot(await res.json());
                    if (active && snapshot && notificationRevision(owner) === revision) publishNotificationState(owner, snapshot);
                }
            } catch { /* A later stream update or user refresh can recover. */ }
        };

        loadNotifications();
        window.addEventListener('focus', loadNotifications);
        window.addEventListener('online', loadNotifications);
        window.addEventListener(NOTIFICATION_REFRESH, loadNotifications);
        return () => {
            active = false;
            window.removeEventListener('focus', loadNotifications);
            window.removeEventListener('online', loadNotifications);
            window.removeEventListener(NOTIFICATION_REFRESH, loadNotifications);
        };
    }, [mounted, owner]);

    const toggleNotifications = () => {
        const newState = !isNotificationsEnabled;
        setIsNotificationsEnabled(newState);
        localStorage.setItem('notifications_enabled', String(newState));
        window.dispatchEvent(new Event('notification-change'));
    };

    const markAsRead = async (id: string) => {
        try {
            const response = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
            if (!response.ok) return;
            const current = notificationState(owner);
            const changed = current.notifications.some(item => item.id === id && !item.read);
            publishNotificationState(owner, { notifications: current.notifications.map(item => item.id === id ? { ...item, read: true } : item), unreadCount: Math.max(0, current.unreadCount - (changed ? 1 : 0)) });
        } catch { /* Keep the unread item if the server did not confirm. */ }
    };

    return <>
        <button type="button" onClick={() => { if (!isOpen) window.dispatchEvent(new Event(NOTIFICATION_REFRESH)); setIsOpen(true); }} className="ui-icon-button relative" aria-label="الإشعارات" aria-haspopup="dialog" aria-expanded={isOpen}>
            {isNotificationsEnabled ? <Bell size={20} aria-hidden="true" /> : <BellOff size={20} aria-hidden="true" />}
            {unreadCount > 0 && isNotificationsEnabled && <span className="absolute -top-1 -right-1 bg-primary text-white text-xs min-w-5 h-5 px-1 rounded-md flex items-center justify-center">{unreadCount > 9 ? '+9' : unreadCount}</span>}
        </button>
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="الإشعارات">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><p className="text-sm text-muted-foreground">غير المقروءة: {unreadCount}</p><button type="button" role="switch" aria-checked={isNotificationsEnabled} className="ui-button" onClick={toggleNotifications}>{isNotificationsEnabled ? 'إيقاف تنبيهات الإشعارات' : 'تفعيل تنبيهات الإشعارات'}</button></div>
            {!notifications.length ? <p className="text-center py-8 text-sm text-muted-foreground">لا توجد إشعارات حالياً.</p> : <ul className="divide-y divide-border">{notifications.map(notification => <li key={notification.id} className="py-4 space-y-2"><div className="flex justify-between gap-3"><h3 className="text-sm font-semibold">{!notification.read && <span className="text-primary ms-0 me-2" aria-label="غير مقروء">•</span>}{notification.title}</h3><time className="text-xs text-muted-foreground shrink-0" dateTime={notification.createdAt}><bdi>{new Date(notification.createdAt).toLocaleDateString('ar-LY')}</bdi></time></div><p className="text-sm text-muted-foreground">{notification.message}</p><div className="flex flex-wrap gap-2">{notification.link && <Link href={notification.link} className="ui-button" onClick={() => setIsOpen(false)}>التفاصيل<ArrowUpRight size={16} aria-hidden="true" /></Link>}{!notification.read && <button type="button" className="ui-button" onClick={() => void markAsRead(notification.id)}>تمييز كمقروء</button>}</div></li>)}</ul>}
        </Modal>
    </>;
}
