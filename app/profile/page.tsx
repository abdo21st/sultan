'use client';

import NavBar from '../components/NavBar';
import { User, Calendar, Shield, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUser(data.user);
                } else {
                    router.push('/login');
                }
            })
            .catch(() => router.push('/login'));
    }, [router]);

    if (!user) return <div className="min-h-screen bg-background flex items-center justify-center">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-background">
            <NavBar />

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {/* Header Background */}
                    <div className="h-32 bg-gradient-to-r from-primary/20 to-amber-500/20"></div>

                    <div className="px-8 pb-8">
                        <div className="relative flex justify-between items-end -mt-12 mb-6">
                            <div className="flex items-end gap-6">
                                <div className="w-24 h-24 rounded-full bg-background p-1 shadow-lg">
                                    <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="w-10 h-10" />
                                    </div>
                                </div>
                                <div className="mb-1">
                                    <h1 className="text-2xl font-bold text-foreground">{user.displayName || user.name}</h1>
                                    <p className="text-muted-foreground" dir="ltr">@{user.username || user.email}</p>
                                </div>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${user.role === 'ADMIN' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                                'bg-primary/10 text-primary border-primary/20'
                                }`}>
                                {user.role === 'ADMIN' ? 'مدير النظام' :
                                    user.role === 'MANAGER' ? 'مدير' :
                                        user.role === 'ACCOUNTANT' ? 'محاسب' :
                                            user.role}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">تفاصيل الحساب</h3>
                                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Shield className="w-4 h-4 text-primary" />
                                            <span className="text-muted-foreground">الصلاحية:</span>
                                            <span className="font-semibold text-foreground">{user.role}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Calendar className="w-4 h-4 text-primary" />
                                            <span className="text-muted-foreground">عضو منذ:</span>
                                            <span className="font-semibold text-foreground" dir="ltr">
                                                {/* Mock date if not in session, or need to fetch full user details */}
                                                2024
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">الإعدادات</h3>
                                <button
                                    onClick={() => {/* Sign out logic */ window.location.href = '/api/auth/signout' }}
                                    className="w-full flex items-center justify-between p-4 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 transition-colors"
                                >
                                    <span className="font-medium">تسجيل الخروج</span>
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
