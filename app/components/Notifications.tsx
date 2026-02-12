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
                    <div className="absolute left-0 mt-5 w-[24rem] bg-white border border-border/80 rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.2)] z-50 overflow-hidden animate-in slide-in-from-top-6 fade-in duration-500 transform-gpu">
                        <div className="p-7 border-b border-border/40 flex justify-between items-center bg-muted/10">
                            <div>
                                <h3 className="text-lg font-black text-foreground tracking-tight leading-none">مركز التنبيهات</h3>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-2">نظام سلطان الرقمي</p>
                            </div>
                            <button
                                onClick={toggleNotifications}
                                className={`text-[10px] font-black px-4 py-2 rounded-2xl transition-all border-2 ${isNotificationsEnabled
                                    ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'
                                    : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                                    }`}
                            >
                                {isNotificationsEnabled ? 'تعطيل الإشعارات' : 'تفعيل الإشعارات'}
                            </button>
                        </div>

                        <div className="max-h-[32rem] overflow-y-auto custom-scrollbar bg-[#fafafa]">
                            {notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center px-12">
                                    <div className="w-20 h-20 rounded-[2rem] bg-muted/30 flex items-center justify-center mb-6 shadow-inner">
                                        <Bell className="w-10 h-10 text-muted-foreground/20" />
                                    </div>
                                    <h4 className="text-base font-black text-foreground">الهدوء يعم المكان</h4>
                                    <p className="text-xs text-muted-foreground font-bold mt-2 leading-relaxed opacity-60">لا توجد تنبيهات جديدة حالياً. سنبقيك على اطلاع دائم.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/30">
                                    {notifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            className={`p-6 hover:bg-white transition-all duration-300 cursor-pointer relative group/notif ${!notification.read ? 'bg-primary/[0.03] border-r-4 border-r-primary' : ''}`}
                                            onClick={() => !notification.read && markAsRead(notification.id)}
                                        >
                                            <div className="flex gap-5">
                                                <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-500 group-hover/notif:scale-125 ${!notification.read ? 'bg-primary shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'bg-muted-foreground/20'}`} />
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-sm font-black text-foreground antialiased tracking-tight group-hover/notif:text-primary transition-colors">{notification.title}</p>
                                                        <span className="text-[10px] font-black text-muted-foreground/40 tabular-nums">
                                                            {new Date(notification.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground font-bold leading-relaxed line-clamp-2 opacity-80">{notification.message}</p>

                                                    {notification.link && (
                                                        <Link
                                                            href={notification.link}
                                                            className="flex items-center gap-2 text-[10px] font-black text-primary hover:gap-3 transition-all mt-4 group-hover/notif:translate-x-1"
                                                            onClick={() => setIsOpen(false)}
                                                        >
                                                            <span>الانتقال للتفاصيل</span>
                                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <ArrowUpRight className="w-3 h-3" />
                                                            </div>
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
                            <div className="p-5 bg-muted/5 border-t border-border/40 text-center">
                                <Link
                                    href="/admin/alerts"
                                    onClick={() => setIsOpen(false)}
                                    className="inline-flex items-center gap-2 text-[11px] font-black text-muted-foreground hover:text-primary transition-all group"
                                >
                                    <span>الأرشيف الكامل للتنبيهات</span>
                                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-primary transition-colors" />
                                </Link>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
