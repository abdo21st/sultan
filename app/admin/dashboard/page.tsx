"use client";

import { useEffect, useState } from "react";
import {
    Banknote,
    ClipboardList,
    TrendingUp,
    LayoutDashboard,
    ArrowUpRight
} from "lucide-react";
import NavBar from "../../components/NavBar";
import { PERMISSIONS } from "../../../lib/permissions";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [stats, setStats] = useState({
        totalSales: 0,
        activeOrdersCount: 0,
        totalDebts: 0
    });

    const isAuthorized = status === "authenticated" && session?.user && (
        session.user.role === 'ADMIN' ||
        session.user.permissions?.includes(PERMISSIONS.DASHBOARD_VIEW) ||
        session.user.permissions?.some(p => ([
            PERMISSIONS.TRANSACTIONS_VIEW,
            PERMISSIONS.USERS_VIEW,
            PERMISSIONS.ROLES_MANAGE,
            PERMISSIONS.SETTINGS_MANAGE
        ] as string[]).includes(p))
    );

    useEffect(() => {
        if (status === "loading") return;
        if (!session?.user || !isAuthorized) {
            router.push("/");
        }
    }, [session, status, isAuthorized, router]);

    useEffect(() => {
        if (isAuthorized) {
            fetch('/api/dashboard/stats')
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setStats(data);
                })
                .catch(console.error);
        }
    }, [isAuthorized]);

    if (status === "loading" || !isAuthorized) {
        return (
            <div className="min-h-screen bg-[#FDFBF7]">
                <NavBar />
                <div className="flex flex-col justify-center items-center h-[70vh] gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-muted animate-pulse border-2 border-border/50"></div>
                    <div className="h-4 w-40 bg-muted rounded-full animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] pb-24">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
                {/* Welcome Section */}
                <header className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-sm">
                            <LayoutDashboard className="w-6 h-6" strokeWidth={2.5} />
                        </div>
                        <div className="h-1 w-12 bg-primary/30 rounded-full" />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">تحليلات النظام</span>
                    </div>
                    <h2 className="text-5xl font-black tracking-tight text-foreground antialiased">
                        لوحة <span className="text-gradient-gold">المعلومات</span>
                    </h2>
                    <p className="text-muted-foreground font-semibold text-lg max-w-2xl leading-relaxed">
                        نظرة استراتيجية شاملة على أداء المنصة، تتبع التدفقات المالية ونشاط الطلبات بشكل لحظي.
                    </p>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Card 1: Sales */}
                    <div className="group relative bg-card rounded-[2.5rem] p-8 shadow-premium hover:shadow-gold transition-all duration-500 border border-border/50 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>

                        <div className="relative flex justify-between items-start mb-10">
                            <div className="p-4 bg-primary/10 rounded-[1.5rem] text-primary shadow-sm group-hover:scale-110 transition-transform duration-500">
                                <TrendingUp className="w-8 h-8" strokeWidth={2.5} />
                            </div>
                            <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1.5 rounded-xl border border-green-100">
                                <ArrowUpRight className="w-4 h-4" />
                                <span className="text-xs font-black">+12%</span>
                            </div>
                        </div>

                        <div className="relative space-y-2">
                            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">إجمالي المبيعات (شهرياً)</p>
                            <h3 className="text-4xl font-black text-foreground tracking-tighter" dir="ltr">
                                {stats.totalSales.toLocaleString()} <span className="text-sm font-bold text-muted-foreground/60">د.ل</span>
                            </h3>
                        </div>
                    </div>

                    {/* Card 2: Active Orders */}
                    <div className="group relative bg-card rounded-[2.5rem] p-8 shadow-premium hover:shadow-gold transition-all duration-500 border border-border/50 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>

                        <div className="relative flex justify-between items-start mb-10">
                            <div className="p-4 bg-blue-500/10 rounded-[1.5rem] text-blue-500 shadow-sm group-hover:scale-110 transition-transform duration-500">
                                <ClipboardList className="w-8 h-8" strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 uppercase tracking-wider">
                                نشط الآن
                            </span>
                        </div>

                        <div className="relative space-y-2">
                            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">تحت التنفيذ</p>
                            <h3 className="text-4xl font-black text-foreground tracking-tighter" dir="ltr">
                                {stats.activeOrdersCount} <span className="text-sm font-bold text-muted-foreground/60">طلب</span>
                            </h3>
                        </div>
                    </div>

                    {/* Card 3: Due Amount */}
                    <div className="group relative bg-card rounded-[2.5rem] p-8 shadow-premium hover:shadow-gold transition-all duration-500 border border-border/50 overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl group-hover:bg-rose-500/10 transition-colors"></div>

                        <div className="relative flex justify-between items-start mb-10">
                            <div className="p-4 bg-rose-500/10 rounded-[1.5rem] text-rose-500 shadow-sm group-hover:scale-110 transition-transform duration-500">
                                <Banknote className="w-8 h-8" strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 uppercase tracking-wider">
                                ذمم مالية
                            </span>
                        </div>

                        <div className="relative space-y-2">
                            <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">الديون المستحقة</p>
                            <h3 className="text-4xl font-black text-foreground tracking-tighter" dir="ltr">
                                {stats.totalDebts.toLocaleString()} <span className="text-sm font-bold text-muted-foreground/60">د.ل</span>
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Additional Insight Banner */}
                <div className="glass-panel p-10 rounded-[3rem] border border-white/40 shadow-premium flex flex-col md:flex-row items-center justify-between gap-8 bg-gradient-to-br from-white/40 to-white/10">
                    <div className="space-y-2 text-center md:text-right">
                        <h4 className="text-2xl font-black text-foreground tracking-tight">جاهز للنمو؟</h4>
                        <p className="text-muted-foreground font-medium">استخدم هذه البيانات لاتخاذ قرارات مدروسة وتوسيع نطاق أعمالك.</p>
                    </div>
                    <div className="flex gap-4">
                        <button className="px-8 py-4 rounded-2xl bg-foreground text-background font-black text-sm shadow-xl hover:scale-105 transition-all">تحميل التقارير</button>
                        <button className="px-8 py-4 rounded-2xl bg-white border border-border text-foreground font-black text-sm shadow-sm hover:scale-105 transition-all">تخصيص اللوحة</button>
                    </div>
                </div>
            </main>
        </div>
    );
}
