'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';

interface Notification {
    id: string;
    title: string;
    message: string;
    read: boolean;
    link?: string;
    createdAt: string;
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('notifications_enabled');
        if (saved !== null) {
            setIsNotificationsEnabled(saved === 'true');
        }
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const loadNotifications = async () => {
            try {
                const res = await fetch('/api/notifications');
                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data.notifications);
                    setUnreadCount(data.unreadCount);
                }
            } catch (error) {
                console.error(error);
            }
        };

        loadNotifications();
        const interval = setInterval(loadNotifications, 30000);
        return () => clearInterval(interval);
    }, [mounted]);

    const toggleNotifications = () => {
        const newState = !isNotificationsEnabled;
        setIsNotificationsEnabled(newState);
        localStorage.setItem('notifications_enabled', String(newState));
        window.dispatchEvent(new Event('notification-change'));
    };

    const markAsRead = async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-muted/50 transition-colors"
            >
                <Bell className={`w-5 h-5 ${isNotificationsEnabled ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} />
                {unreadCount > 0 && isNotificationsEnabled && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
                )}
                {!isNotificationsEnabled && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-zinc-400 rounded-full ring-2 ring-white" />
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-3 border-b border-border bg-muted/30 flex justify-between items-center">
                            <h3 className="font-semibold text-sm">الإشعارات</h3>
                            <button
                                onClick={toggleNotifications}
                                className={`text-xs px-2 py-1 rounded-md transition-colors ${isNotificationsEnabled
                                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                    }`}
                            >
                                {isNotificationsEnabled ? 'تنبيهات مفعلة' : 'تنبيهات متوقفة'}
                            </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <p className="p-8 text-center text-muted-foreground text-sm">
                                    لا توجد إشعارات جديدة
                                </p>
                            ) : (
                                <div className="divide-y divide-border">
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`p-4 hover:bg-muted/50 transition-colors ${!notification.read ? 'bg-primary/5' : ''}`}
                                            onClick={() => !notification.read && markAsRead(notification.id)}
                                        >
                                            <div className="flex gap-3">
                                                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!notification.read ? 'bg-primary' : 'bg-transparent'}`} />
                                                <div className="space-y-1">
                                                    <p className="text-sm font-medium leading-none">{notification.title}</p>
                                                    <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>

                                                    {notification.link && (
                                                        <Link
                                                            href={notification.link}
                                                            className="text-xs text-primary hover:underline mt-2 inline-block"
                                                            onClick={() => setIsOpen(false)}
                                                        >
                                                            عرض التفاصيل
                                                        </Link>
                                                    )}

                                                    <p className="text-[10px] text-muted-foreground pt-1">
                                                        {new Date(notification.createdAt).toLocaleString('ar-EG')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
