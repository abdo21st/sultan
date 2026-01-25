'use client';

import { PERMISSIONS } from '@/lib/permissions';

import Link from 'next/link';
import { Search, LogOut, User, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Notifications from './Notifications';

export default function NavBar() {
    const [user, setUser] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
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
        <nav className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
                            {settings?.logoUrl && <img src={settings.logoUrl} alt="Logo" className="w-8 h-8 rounded-md object-cover" />}
                            <span>{settings?.appName || 'سلطان'}</span>
                        </Link>
                        <div className="hidden md:flex gap-6 items-center">

                            <Link
                                href="/transactions"
                                className={`text-sm font-medium transition-colors ${pathname === '/transactions' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                            >
                                المعاملات
                            </Link>

                            {/* Check USERS_VIEW permission */}
                            {user && (user.permissions?.includes(PERMISSIONS.USERS_VIEW) || user.role === 'ADMIN') && (
                                <Link
                                    href="/admin/users"
                                    className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/users') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                    المستخدمين
                                </Link>
                            )}

                            {/* Check ROLES_MANAGE permission */}
                            {user && (user.permissions?.includes(PERMISSIONS.ROLES_MANAGE) || user.role === 'ADMIN') && (
                                <Link
                                    href="/admin/roles"
                                    className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/roles') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                    الأدوار
                                </Link>
                            )}

                            {/* Check SETTINGS_MANAGE permission */}
                            {user && (user.permissions?.includes(PERMISSIONS.SETTINGS_MANAGE) || user.role === 'ADMIN') && (
                                <>
                                    <Link
                                        href="/admin/analytics"
                                        className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/analytics') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                    >
                                        التقارير
                                    </Link>
                                    <Link
                                        href="/admin/booking"
                                        className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/booking') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                    >
                                        الحجز
                                    </Link>
                                    <Link
                                        href="/admin/alerts"
                                        className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/alerts') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                    >
                                        التنبيهات
                                    </Link>
                                    <Link
                                        href="/admin/settings"
                                        className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/settings') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                    >
                                        الإعدادات
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4 relative">
                        {user && <Notifications />}
                        {user && (
                            <div className="relative group/menu">
                                <Link href="/profile" className="flex items-center gap-3 pl-4 border-l border-border cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-sm font-bold text-foreground">{user.displayName || user.name || user.username}</p>
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                                            {user.role === 'ADMIN' ? 'مدير النظام' :
                                                user.role === 'MANAGER' ? 'مدير' :
                                                    user.role === 'ACCOUNTANT' ? 'محاسب' :
                                                        user.role || 'زائر'}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-primary/20">
                                        <User className="w-4 h-4" />
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
                                        <a href="/api/auth/signout" className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors w-full text-right">
                                            <LogOut className="w-4 h-4" />
                                            <span>تسجيل الخروج</span>
                                        </a>
                                        <a href="/api/auth/signout?callbackUrl=/login" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors w-full text-right">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>
                                            <span>تبديل المستخدم</span>
                                        </a>
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
