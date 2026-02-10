"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, X } from "lucide-react";

export default function NotificationListener() {
    const { data: session } = useSession();
    const [toasts, setToasts] = useState<{ id: string; title: string; message: string }[]>([]);

    const [enabled, setEnabled] = useState(true);

    // Sync state with local storage and other components
    useEffect(() => {
        const checkState = () => {
            const saved = localStorage.getItem('notifications_enabled');
            setEnabled(saved !== 'false'); // Default true
        };

        checkState();
        window.addEventListener('notification-change', checkState);
        return () => window.removeEventListener('notification-change', checkState);
    }, []);

    useEffect(() => {
        if (!session || !enabled) return;

        const eventSource = new EventSource("/api/notifications/stream");

        eventSource.onmessage = (event) => {
            const notifications = JSON.parse(event.data);
            if (Array.isArray(notifications)) {
                // Add new unique notifications to toasts
                setToasts(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const newToasts = notifications.filter(n => !existingIds.has(n.id));
                    if (newToasts.length === 0) return prev;

                    // Trigger sound for new ones
                    const audio = new Audio('/notification.mp3'); // Optional
                    audio.play().catch(() => { });

                    return [...newToasts, ...prev].slice(0, 3); // Max 3 toasts
                });
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [session, enabled]);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-3 w-80 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-white/10 animate-in slide-in-from-left duration-500 pointer-events-auto flex items-start gap-3"
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
