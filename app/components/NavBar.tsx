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
        <nav className="border-b border-border/40 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-50 glass">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex items-center gap-10">
                        <Link href="/" className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-amber-700 p-0.5 shadow-lg shadow-primary/20">
                                <div className="w-full h-full rounded-[10px] bg-zinc-900 flex items-center justify-center">
                                    {settings?.logoUrl ? (
                                        <Image
                                            src={settings.logoUrl}
                                            alt="Logo"
                                            width={28}
                                            height={28}
                                            className="rounded-md object-cover"
                                        />
                                    ) : (
                                        <span className="text-primary font-black text-xl">س</span>
                                    )}
                                </div>
                            </div>
                            <span className="text-2xl tracking-tight font-black text-gradient-gold drop-shadow-sm">
                                {settings?.appName || 'سلطان'}
                            </span>
                        </Link>
                        <div className="flex items-center gap-4">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                className="p-2 -ml-2 rounded-md text-foreground hover:bg-muted focus:outline-none"
                                aria-label="Open menu"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Drawer Overlay */}
                    {/* Drawer Overlay */}
                    {isMenuOpen && typeof document !== 'undefined' && createPortal(
                        <div className="fixed inset-0 z-[100] flex justify-start">
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                                onClick={() => setIsMenuOpen(false)}
                            />

                            {/* Drawer Content */}
                            <div className="relative w-80 h-full bg-white dark:bg-zinc-900 shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto border-l border-zinc-200 dark:border-zinc-800">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-xl font-bold text-foreground">القائمة الرئيسية</h2>
                                        <button
                                            onClick={() => setIsMenuOpen(false)}
                                            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                            aria-label="Close menu"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {/* Check TRANSACTIONS_VIEW permission */}
                                        {user && (user.role === 'ADMIN' || user.permissions?.includes(PERMISSIONS.TRANSACTIONS_VIEW)) && (
                                            <Link
                                                href="/transactions"
                                                onClick={() => setIsMenuOpen(false)}
                                                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname === '/transactions'
                                                    ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    }`}
                                            >
                                                المعاملات
                                            </Link>
                                        )}

                                        {/* Check USERS_VIEW permission */}
                                        {user && (user.permissions?.includes(PERMISSIONS.USERS_VIEW)) && (
                                            <Link
                                                href="/admin/users"
                                                onClick={() => setIsMenuOpen(false)}
                                                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/admin/users')
                                                    ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    }`}
                                            >
                                                المستخدمين
                                            </Link>
                                        )}

                                        {/* Check ROLES_MANAGE permission */}
                                        {user && (user.permissions?.includes(PERMISSIONS.ROLES_MANAGE)) && (
                                            <Link
                                                href="/admin/roles"
                                                onClick={() => setIsMenuOpen(false)}
                                                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/admin/roles')
                                                    ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    }`}
                                            >
                                                الأدوار
                                            </Link>
                                        )}

                                        {/* Check SETTINGS_MANAGE permission */}
                                        {user && (user.permissions?.includes(PERMISSIONS.SETTINGS_MANAGE)) && (
                                            <>
                                                <Link
                                                    href="/admin/analytics"
                                                    onClick={() => setIsMenuOpen(false)}
                                                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/admin/analytics')
                                                        ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        }`}
                                                >
                                                    التقارير
                                                </Link>
                                                <Link
                                                    href="/admin/booking"
                                                    onClick={() => setIsMenuOpen(false)}
                                                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/admin/booking')
                                                        ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        }`}
                                                >
                                                    الحجز
                                                </Link>
                                                <Link
                                                    href="/admin/alerts"
                                                    onClick={() => setIsMenuOpen(false)}
                                                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/admin/alerts')
                                                        ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        }`}
                                                >
                                                    التنبيهات
                                                </Link>
                                                <Link
                                                    href="/admin/settings"
                                                    onClick={() => setIsMenuOpen(false)}
                                                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${pathname.startsWith('/admin/settings')
                                                        ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                        }`}
                                                >
                                                    الإعدادات
                                                </Link>
                                            </>
                                        )}

                                        {/* Mobile App Download Link */}
                                        <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                                            <a
                                                href="/downloads/sultan-v1.apk"
                                                download="sultan-v1.apk"
                                                onClick={() => setIsMenuOpen(false)}
                                                className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-gradient-to-br from-primary to-amber-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all duration-300"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="rotate-0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                                تنزيل تطبيق أندرويد
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    <div className="flex items-center gap-4 relative">
                        {user && (
                            <a
                                href="/downloads/sultan-v1.apk"
                                download="sultan-v1.apk"
                                title="تحميل تطبيق أندرويد"
                                className="hidden md:flex w-10 h-10 rounded-xl bg-white/5 border border-white/5 items-center justify-center text-primary hover:bg-white/10 hover:border-primary/30 transition-all duration-300 group/dl"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/dl:translate-y-0.5 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            </a>
                        )}
                        {user && <Notifications />}
                        {user && (
                            <div className="relative group/menu">
                                <Link href="/profile" className="flex items-center gap-3 pl-4 border-r border-border/40 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all duration-300">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-sm font-black text-foreground antialiased tracking-wide">{user.displayName || user.name || user.username}</p>
                                        <p className="text-[9px] uppercase font-bold tracking-[0.1em] text-primary/80">
                                            {user.role === 'ADMIN' ? 'مدير النظام' :
                                                user.role === 'MANAGER' ? 'مدير' :
                                                    user.role === 'ACCOUNTANT' ? 'محاسب' :
                                                        user.role || 'زائر'}
                                        </p>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-border/50 text-white flex items-center justify-center font-bold shadow-xl overflow-hidden group-hover/menu:border-primary/50 transition-colors">
                                        <User className="w-5 h-5 text-primary" />
                                    </div>
                                </Link>

                                {/* Dropdown Menu */}
                                <div className="absolute left-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 transform origin-top-left z-50">
                                    <div className="p-1">
                                        <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors">
                                            <User className="w-4 h-4" />
                                            <span>الملف الشخصي</span>
                                        </Link>
                                        <div className="my-1 border-t border-border"></div>
                                        <Link href="/api/auth/signout" className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full text-right">
                                            <LogOut className="w-4 h-4" />
                                            <span>تسجيل الخروج</span>
                                        </Link>
                                        <Link href="/api/auth/signout?callbackUrl=/login" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors w-full text-right">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                                            <span>تبديل المستخدم</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
