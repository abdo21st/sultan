'use client';

import Link from 'next/link';
import { Search, LogOut, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function NavBar() {
    const [user, setUser] = useState<any>(null);
    const pathname = usePathname();

    useEffect(() => {
        // Fetch session manually to avoid dragging in complex server components here if not needed,
        // or better, use a server component wrapper. But for now, client fetch is easiest for this quick fix.
        // Actually, in NextAuth v5 client side we use getSession or useSession.
        // Importing 'next-auth/react' might be heavy/tricky without provider.
        // Let's create a simple API for 'me' or just fetch session.
        // For simplicity/speed without touching layout providers:
        // We'll rely on a lightweight fetch to check /api/auth/session
        fetch('/api/auth/session').then(res => res.json()).then(data => {
            if (data?.user) setUser(data.user);
        }).catch(() => { });
    }, []);

    return (
        <nav className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
                            سلطان
                        </Link>
                        <div className="hidden md:flex gap-6 items-center">
                            <Link
                                href="/transactions"
                                className={`text-sm font-medium transition-colors ${pathname === '/transactions' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                            >
                                المعاملات
                            </Link>
                            {/* Show Users link only if Admin or Manager (client side check for visibility) */}
                            {(!user || user.role === 'ADMIN' || user.role === 'MANAGER') && (
                                <Link
                                    href="/admin/users"
                                    className={`text-sm font-medium transition-colors ${pathname.startsWith('/admin/users') ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                    المستخدمين
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {user && (
                            <div className="flex items-center gap-3 pl-4 border-l border-border">
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-bold text-foreground">{user.displayName || user.name || user.username}</p>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                                        {user.role || 'GUEST'}
                                    </p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-md shadow-primary/20">
                                    <User className="w-4 h-4" />
                                </div>
                            </div>
                        )}
                        {/* Logout button (just linking to signout for now or simple form) */}
                        {/* <button className="p-2 text-muted-foreground hover:text-red-500 transition-colors" title="تسجيل الخروج">
                    <LogOut className="w-5 h-5" />
                </button> */}
                    </div>
                </div>
            </div>
        </nav>
    );
}
