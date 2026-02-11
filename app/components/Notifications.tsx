'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, ArrowUpRight } from 'lucide-react';
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
                className="relative w-12 h-12 rounded-2xl bg-muted/30 border border-border/50 flex items-center justify-center hover:bg-muted/80 hover:border-primary/30 transition-all duration-300 group"
                aria-label="التنبيهات"
            >
                {isNotificationsEnabled ? (
                    <Bell className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                ) : (
                    <BellOff className="w-5 h-5 text-muted-foreground/40" />
                )}

                {unreadCount > 0 && isNotificationsEnabled && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black flex items-center justify-center rounded-lg ring-4 ring-background animate-in zoom-in shadow-gold">
                        {unreadCount > 9 ? '+9' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute left-0 mt-4 w-[22rem] bg-card/95 backdrop-blur-xl border border-border/50 rounded-[2rem] shadow-premium z-50 overflow-hidden animate-in slide-in-from-top-4 duration-300 transform-gpu">
                        <div className="p-6 border-b border-border/50 flex justify-between items-center bg-muted/20">
                            <div>
                                <h3 className="font-black text-foreground tracking-tight">مركز التنبيهات</h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">سلطان • إشعارات النظام</p>
                            </div>
                            <button
                                onClick={toggleNotifications}
                                className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition-all border ${isNotificationsEnabled
                                    ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                    }`}
                            >
                                {isNotificationsEnabled ? 'تعطيل' : 'تفعيل'}
                            </button>
                        </div>

                        <div className="max-h-[30rem] overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                                    <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
                                        <Bell className="w-8 h-8 text-muted-foreground/30" />
                                    </div>
                                    <h4 className="text-sm font-black text-foreground capitalize">لا توجد تنبيهات</h4>
                                    <p className="text-xs text-muted-foreground font-medium mt-1">سنخطرك هنا بمجرد توفر تحديثات جديدة لطلباتك.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`p-5 hover:bg-muted/30 transition-colors cursor-pointer relative group/notif ${!notification.read ? 'bg-primary/[0.02]' : ''}`}
                                            onClick={() => !notification.read && markAsRead(notification.id)}
                                        >
                                            <div className="flex gap-4">
                                                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!notification.read ? 'bg-primary shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-transparent border border-border/80'}`} />
                                                <div className="space-y-1.5 flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-sm font-black text-foreground antialiased tracking-tight">{notification.title}</p>
                                                        <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">
                                                            {new Date(notification.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground font-medium leading-relaxed line-clamp-2">{notification.message}</p>

                                                    {notification.link && (
                                                        <Link
                                                            href={notification.link}
                                                            className="flex items-center gap-1.5 text-[10px] font-black text-primary hover:gap-2 transition-all mt-3 group-hover/notif:translate-x-1"
                                                            onClick={() => setIsOpen(false)}
                                                        >
                                                            <span>عرض التفاصيل</span>
                                                            <ArrowUpRight className="w-3 h-3" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <div className="p-4 bg-muted/10 border-t border-border/50 text-center">
                                <Link
                                    href="/admin/alerts"
                                    onClick={() => setIsOpen(false)}
                                    className="text-xs font-black text-muted-foreground hover:text-primary transition-colors"
                                >
                                    عرض جميع التنبيهات المؤرشفة
                                </Link>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
