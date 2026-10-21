"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, X } from "lucide-react";
import { activateNotificationOwner, clearNotificationOwner, mergeLegacyNotifications, NOTIFICATION_REFRESH, parseNotificationItems, parseNotificationSnapshot, publishNotificationState } from '@/lib/notification-client-state';

export default function NotificationListener() {
    const { data: session } = useSession();
    const owner = session?.user && !session.user.mustChangePassword ? `${session.user.id}:${session.user.sessionVersion}` : '';
    const [toastState, setToastState] = useState<{ owner: string; items: { id: string; title: string; message: string }[] }>({ owner: '', items: [] });

    const [enabled, setEnabled] = useState(true);

    // Sync state with local storage and other components
    useEffect(() => {
        const checkState = () => {
            const saved = localStorage.getItem('notifications_enabled');
            setEnabled(saved !== 'false'); // Default true
            if (saved === 'false') setToastState({ owner: '', items: [] });
        };

        checkState();
        window.addEventListener('notification-change', checkState);
        return () => window.removeEventListener('notification-change', checkState);
    }, []);

    useEffect(() => {
        activateNotificationOwner(owner);
        return () => clearNotificationOwner(owner);
    }, [owner]);

    useEffect(() => {
        if (!owner || !enabled) return;

        const eventSource = new EventSource("/api/notifications/stream");
        let closed = false;
        let hasStateProtocol = false;
        eventSource.onopen = () => window.dispatchEvent(new Event(NOTIFICATION_REFRESH));
        eventSource.addEventListener('state', (event) => {
            if (closed) return;
            try {
                const snapshot = parseNotificationSnapshot(JSON.parse(event.data));
                if (snapshot) { hasStateProtocol = true; publishNotificationState(owner, snapshot); }
            } catch { /* Discard malformed transport data. */ }
        });

        eventSource.onmessage = (event) => {
            if (closed) return;
            let notifications;
            try { notifications = parseNotificationItems(JSON.parse(event.data)); } catch { return; }
            if (notifications) {
                // Keep existing pages compatible if the server is rolled back.
                if (!hasStateProtocol) mergeLegacyNotifications(owner, notifications);
                // Add new unique notifications to toasts
                setToastState(previous => {
                    const prev = previous.owner === owner ? previous.items : [];
                    const existingIds = new Set(prev.map(t => t.id));
                    const newToasts = notifications.filter(n => !existingIds.has(n.id));
                    if (newToasts.length === 0) return previous;

                    // Trigger sound for new ones
                    const audio = new Audio('/notification.mp3'); // Optional
                    audio.play().catch(() => { });

                    return { owner, items: [...newToasts, ...prev].slice(0, 3) }; // Max 3 toasts
                });
            }
        };

        return () => {
            closed = true;
            eventSource.close();
        };
    }, [owner, enabled]);

    const removeToast = (id: string) => {
        setToastState(prev => ({ ...prev, items: prev.items.filter(t => t.id !== id) }));
    };

    const toasts = enabled && toastState.owner === owner ? toastState.items : [];
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 w-80 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="bg-zinc-900 text-white rounded-xl p-4  border border-white/10 animate-in slide-in-from-left duration-500 pointer-events-auto flex items-start gap-3"
                >
                    <div className="bg-primary/20 p-2 rounded-xl">
                        <Bell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-sm">{toast.title}</h4>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{toast.message}</p>
                    </div>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-zinc-500 hover:text-white transition-colors"
                        title="close notification"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
