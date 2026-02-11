'use client';

import { PERMISSIONS } from '../../lib/permissions';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, User, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Notifications from './Notifications';

interface User {
    displayName?: string;
    name?: string;
    username: string;
    role: string;
    permissions?: string[];
}

interface SystemSettings {
    logoUrl?: string;
    appName?: string;
}

export default function NavBar() {
    const [user, setUser] = useState<User | null>(null);
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        // Fetch session
        fetch('/api/auth/session').then(res => res.json()).then(data => {
            if (data?.user) setUser(data.user);
        }).catch(() => { });

        // Fetch system settings
        fetch('/api/settings').then(res => res.json()).then(data => {
            if (data && !data.error) setSettings(data);
        }).catch(() => { });
    }, []);

    return (
        <nav className="glass-panel sticky top-0 z-50 border-b border-border/50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex items-center gap-10">
                        <Link href="/" className="flex items-center gap-3 active:scale-95 transition-transform">
                            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-amber-900 p-[2px] shadow-gold">
                                <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                                    {settings?.logoUrl ? (
                                        <Image
                                            src={settings.logoUrl}
                                            alt="Logo"
                                            width={32}
                                            height={32}
                                            className="rounded-lg object-cover"
                                        />
                                    ) : (
                                        <span className="text-primary font-black text-2xl drop-shadow-sm">س</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-2xl tracking-tighter font-black text-gradient-gold antialiased leading-none">
                                    {settings?.appName || 'سلطان'}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground/60 leading-tight">سجل الطلبات</span>
                            </div>
                        </Link>

                        <div className="hidden lg:flex items-center gap-6">
                            <Link href="/" className={`text-sm font-bold transition-colors ${pathname === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>الطلبات</Link>
                            {user && (user.role === 'ADMIN' || user.permissions?.includes(PERMISSIONS.DASHBOARD_VIEW)) && (
                                <Link href="/admin/dashboard" className={`text-sm font-bold transition-colors ${pathname === '/admin/dashboard' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>الإحصائيات</Link>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 md:gap-4">
                            {user && (
                                <a
                                    href="/downloads/sultan-v1.apk"
                                    download="sultan-v1.apk"
                                    title="تحميل تطبيق أندرويد"
                                    className="hidden md:flex w-11 h-11 rounded-2xl bg-muted border border-border items-center justify-center text-primary hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 group/dl"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/dl:translate-y-0.5 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                </a>
                            )}
                            {user && <Notifications />}

                            {user ? (
                                <div className="relative group/menu">
                                    <div className="flex items-center gap-3 cursor-pointer p-1 rounded-2xl hover:bg-muted/50 transition-all duration-300">
                                        <div className="text-right hidden sm:block mr-2">
                                            <p className="text-sm font-black text-foreground antialiased tracking-tight">{user.displayName || user.name || user.username}</p>
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-primary/80">
                                                {user.role === 'ADMIN' ? 'مدير النظام' :
                                                    user.role === 'MANAGER' ? 'مدير' :
                                                        user.role === 'ACCOUNTANT' ? 'محاسب' :
                                                            user.role || 'زائر'}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-white border-2 border-border text-foreground flex items-center justify-center font-bold shadow-sm overflow-hidden group-hover/menu:border-primary/50 transition-all">
                                            <User className="w-6 h-6 text-primary" />
                                        </div>
                                    </div>

                                    <div className="absolute left-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-premium opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-300 transform translate-y-2 group-hover/menu:translate-y-0 origin-top-left z-50">
                                        <div className="p-2">
                                            <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-foreground hover:bg-muted rounded-xl transition-colors">
                                                <User className="w-4 h-4 text-primary" />
                                                <span>الملف الشخصي</span>
                                            </Link>
                                            <div className="my-1 border-t border-border"></div>
                                            <button
                                                onClick={() => window.location.href = '/api/auth/signout'}
                                                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors w-full text-right"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span>تسجيل الخروج</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Link href="/login" className="px-6 py-2.5 rounded-xl bg-primary text-white font-black text-sm shadow-gold">تسجيل الدخول</Link>
                            )}

                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="lg:hidden p-3 rounded-2xl bg-muted text-foreground border border-border"
                                aria-label="Open menu"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isMenuOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity animate-in fade-in duration-500"
                        onClick={() => setIsMenuOpen(false)}
                    />
                    <div className="relative w-[320px] h-full glass-panel shadow-2xl animate-in slide-in-from-left duration-500 overflow-y-auto border-r border-white/20">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-10">
                                <h2 className="text-2xl font-black text-foreground tracking-tight">القائمة</h2>
                                <button
                                    onClick={() => setIsMenuOpen(false)}
                                    className="p-2.5 rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Close menu"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-4 px-2">الطلبات</h3>
                                    <div className="space-y-2">
                                        <Link href="/" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black transition-all ${pathname === '/' ? 'bg-primary text-white shadow-gold' : 'hover:bg-muted text-muted-foreground'}`}>
                                            قائمة الطلبات
                                        </Link>
                                        <Link href="/orders/new" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black transition-all ${pathname === '/orders/new' ? 'bg-primary text-white shadow-gold' : 'hover:bg-muted text-muted-foreground'}`}>
                                            طلب جديد
                                        </Link>
                                    </div>
                                </div>
                                {user && (user.role === 'ADMIN' || user.permissions?.includes(PERMISSIONS.DASHBOARD_VIEW)) && (
                                    <div>
                                        <h3 className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-4 px-2">الإدارة</h3>
                                        <div className="space-y-2">
                                            <Link href="/admin/dashboard" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black transition-all ${pathname === '/admin/dashboard' ? 'bg-primary text-white shadow-gold' : 'hover:bg-muted text-muted-foreground'}`}>
                                                لوحة المعلومات
                                            </Link>
                                            <Link href="/admin/users" onClick={() => setIsMenuOpen(false)} className={`flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black transition-all ${pathname === '/admin/users' ? 'bg-primary text-white shadow-gold' : 'hover:bg-muted text-muted-foreground'}`}>
                                                المستخدمين
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </nav>
    );
}
