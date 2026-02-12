"use client";

import { useEffect, useState } from "react";
import {
    Banknote,
    ClipboardList,
    TrendingUp,
    LayoutDashboard,
    ArrowUpRight,
    ArrowDownRight,
    Loader2,
    Calendar,
    Download,
    PieChart as PieChartIcon
} from "lucide-react";
import NavBar from "../../components/NavBar";
import { PERMISSIONS } from "../../../lib/permissions";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444'];

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalSales: 0,
        activeOrdersCount: 0,
        totalDebts: 0,
        dailySales: [],
        statusDistribution: [],
        growth: 0
    });

    const isAuthorized = status === "authenticated" && session?.user && (
        session.user.role === 'ADMIN' ||
        session.user.permissions?.includes(PERMISSIONS.DASHBOARD_VIEW)
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
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [isAuthorized]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen bg-[#FDFBF7]">
                <NavBar />
                <div className="flex flex-col justify-center items-center h-[70vh] gap-6">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground font-black animate-pulse">جاري تحليل البيانات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] pb-24">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 animate-in fade-in duration-700">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                                <LayoutDashboard className="w-6 h-6" strokeWidth={3} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">الذكاء المالي</span>
                        </div>
                        <h2 className="text-5xl font-black tracking-tight text-foreground antialiased">
                            مركز <span className="text-gradient-gold">القيادة</span>
                        </h2>
                        <p className="text-muted-foreground font-bold text-lg max-w-2xl opacity-80 leading-relaxed">
                            مؤشرات أداء متقدمة تمنحك تحكماً كاملاً في تدفقات متجرك الملكي.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="h-14 px-6 rounded-2xl bg-white border border-border/60 text-foreground font-black text-sm flex items-center gap-3 shadow-sm hover:border-primary/40 transition-all hover:bg-muted/30">
                            <Calendar className="w-5 h-5 text-primary" />
                            <span>آخر 30 يوم</span>
                        </button>
                        <button className="h-14 px-8 rounded-2xl bg-foreground text-background font-black text-sm flex items-center gap-3 shadow-gold transition-all hover:scale-105 active:scale-95">
                            <Download className="w-5 h-5" />
                            <span>تصدير</span>
                        </button>
                    </div>
                </header>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                    {/* Sales Card */}
                    <div className="glass-card p-8 group overflow-hidden bg-gradient-to-br from-white to-amber-50/30">
                        <div className="flex justify-between items-start mb-10">
                            <div className="p-5 bg-primary/10 rounded-[2rem] text-primary shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <TrendingUp className="w-8 h-8" strokeWidth={3} />
                            </div>
                            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-[10px] font-black border transition-all ${stats.growth >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                }`}>
                                {stats.growth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                                <span>%{Math.abs(stats.growth)} نمو</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">إجمالي المبيعات</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-foreground tracking-tighter" dir="ltr">{stats.totalSales.toLocaleString()}</span>
                                <span className="text-lg font-black text-primary/60">د.ل</span>
                            </div>
                            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-1000"
                                    data-width={Math.min(100, (stats.totalSales / 50000) * 100)}
                                    style={{ width: `${Math.min(100, (stats.totalSales / 50000) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Orders Card */}
                    <div className="glass-card p-8 group overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                        <div className="flex justify-between items-start mb-10">
                            <div className="p-5 bg-blue-500/10 rounded-[2rem] text-blue-500 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <ClipboardList className="w-8 h-8" strokeWidth={3} />
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                {stats.activeOrdersCount} طلب نشط
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">طلبات قيد التنفيذ</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-foreground tracking-tighter">{stats.activeOrdersCount}</span>
                                <span className="text-lg font-black text-blue-500/60">عملية</span>
                            </div>
                            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                    data-width={Math.min(100, (stats.activeOrdersCount / 50) * 100)}
                                    style={{ width: `${Math.min(100, (stats.activeOrdersCount / 50) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Debt Card */}
                    <div className="glass-card p-8 group overflow-hidden bg-gradient-to-br from-white to-rose-50/30">
                        <div className="flex justify-between items-start mb-10">
                            <div className="p-5 bg-rose-500/10 rounded-[2rem] text-rose-500 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                <Banknote className="w-8 h-8" strokeWidth={3} />
                            </div>
                            <div className="px-4 py-2 rounded-2xl text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-100 uppercase">
                                جاري التحصيل
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">إجمالي الديون</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-foreground tracking-tighter" dir="ltr">{stats.totalDebts.toLocaleString()}</span>
                                <span className="text-lg font-black text-rose-500/60">د.ل</span>
                            </div>
                            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                                    data-width={Math.min(100, (stats.totalDebts / 20000) * 100)}
                                    style={{ width: `${Math.min(100, (stats.totalDebts / 20000) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    {/* Main Sales Chart */}
                    <div className="lg:col-span-2 glass-card p-8 bg-white/60">
                        <div className="flex items-center justify-between mb-8">
                            <div className="space-y-1">
                                <h4 className="text-xl font-black text-foreground antialiased">نمو المبيعات اليومي</h4>
                                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">تتبع أداء المبيعات الحقيقي للشهر الحالي</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-primary/5 text-primary border border-primary/20">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.dailySales}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 900 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 900 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900 }}
                                        itemStyle={{ color: '#F59E0B' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sales"
                                        stroke="#F59E0B"
                                        strokeWidth={4}
                                        fillOpacity={1}
                                        fill="url(#colorSales)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Status Pie Chart */}
                    <div className="glass-card p-8 bg-white/60 flex flex-col items-center">
                        <div className="w-full flex items-center justify-between mb-8">
                            <div className="space-y-1">
                                <h4 className="text-xl font-black text-foreground antialiased">توزيع الحالات</h4>
                                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">تحليل حالة الطلبات النشطة</p>
                            </div>
                            <div className="p-3 rounded-2xl bg-blue-500/5 text-blue-500 border border-blue-500/20">
                                <PieChartIcon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.statusDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {stats.statusDistribution.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-3 mt-6">
                            {stats.statusDistribution.map((entry: { name: string; value: number }, index) => (
                                <div key={entry.name} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            data-color={COLORS[index % COLORS.length]}
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        ></div>
                                        <span className="text-sm font-bold text-muted-foreground">{entry.name}</span>
                                    </div>
                                    <span className="text-sm font-black text-foreground">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
