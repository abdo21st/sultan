"use client";

import { useState, useEffect, useCallback } from "react";
import NavBar from "../../components/NavBar";
import {
    BarChart, Bar, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis
} from "recharts";
import {
    LayoutDashboard,
    Download,
    Calendar,
    DollarSign,
    ClipboardList,
    Factory as FactoryIcon,
    Users as UsersIcon,
    RefreshCw,
    Filter,
    Loader2,
    TrendingUp,
    Banknote,
    Package,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "../../../lib/permissions";
import { exportToPDF } from "@/lib/pdf-export";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

interface Facility {
    id: string;
    name: string;
    type: string;
}

interface FinancialDetail {
    id: string;
    date: string;
    type: "INCOME" | "EXPENSE";
    category: string;
    amount: number;
    description: string | null;
}

interface OperationalDetail {
    id: string;
    customerName: string;
    status: string;
    totalAmount: number;
    createdAt: string;
}

interface ProductionDetail {
    name: string;
    count: number;
    value: number;
}

interface UserDetail {
    id: string;
    name: string;
    transactionCount: number;
    volume: number;
}

interface ReportData {
    type: "financial" | "operational" | "production" | "users";
    summary: {
        totalIncome?: number;
        totalExpense?: number;
        netProfit?: number;
        totalOrders?: number;
        statusDistribution?: { name: string; value: number }[];
    };
    details: (FinancialDetail | OperationalDetail | ProductionDetail | UserDetail)[];
}

export default function FlexibleReportsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // States
    const [reportType, setReportType] = useState<"financial" | "operational" | "production" | "users">("financial");
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [filters, setFilters] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        facilityId: ""
    });
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);

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

    // Fetch Initial Data
    useEffect(() => {
        if (isAuthorized) {
            fetch("/api/facilities")
                .then(res => res.json())
                .then(setFacilities)
                .catch(console.error);
        }
    }, [isAuthorized]);

    // Fetch Report Data
    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                type: reportType,
                start: filters.start,
                end: filters.end,
                ...(filters.facilityId && { facilityId: filters.facilityId })
            });
            const res = await fetch(`/api/admin/reports?${query}`);
            const data = await res.json();
            setReportData(data);
        } catch (err) {
            toast.error("فشل تحميل بيانات التقرير");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [reportType, filters]);

    useEffect(() => {
        if (isAuthorized) {
            fetchReport();
        }
    }, [isAuthorized, fetchReport]);

    // PDF Export Logic
    const STATUS_MAP: Record<string, string> = {
        "PENDING": "قيد الانتظار",
        "PROCESSING": "قيد التنفيذ",
        "COMPLETED": "مكتمل",
        "CANCELLED": "ملغي",
        "DELIVERED": "تم التسليم",
        "orders:status:pending": "قيد الانتظار",
        "orders:status:registered": "قيد التسجيل",
        "orders:status:shop_ready": "جاهز للعرض",
        "orders:status:review": "المراجعة",
        "orders:status:processing": "قيد التنفيذ",
        "orders:status:delivering_to_factory": "التوصيل للمصنع",
        "orders:status:factory": "في المصنع",
        "orders:status:delivering": "التوصيل للعميل",
        "orders:status:completed": "مكتمل",
        "orders:status:cancelled": "ملغي",
        "orders:status:refused": "مرفوض",
        "System": "النظام"
    };

    const handlePDFExport = () => {
        if (!reportData) return;

        let columns: { header: string; dataKey: string }[] = [];
        let rows: Record<string, string | number>[] = [];
        let title = "";

        switch (reportType) {
            case "financial":
                title = "التقرير المالي";
                columns = [
                    { header: "التاريخ", dataKey: "date" },
                    { header: "النوع", dataKey: "type" },
                    { header: "التصنيف", dataKey: "category" },
                    { header: "المبلغ", dataKey: "amount" },
                    { header: "البيان", dataKey: "description" }
                ];
                rows = (reportData.details as FinancialDetail[]).map(t => ({
                    date: new Date(t.date).toLocaleDateString('ar-EG'),
                    type: t.type === "INCOME" ? "دخل" : "مصروف",
                    category: t.category,
                    amount: formatCurrency(t.amount),
                    description: t.description || ""
                }));
                break;
            case "operational":
                title = "تقرير العمليات";
                columns = [
                    { header: "رقم الطلب", dataKey: "id" },
                    { header: "العميل", dataKey: "customer" },
                    { header: "الحالة", dataKey: "status" },
                    { header: "القيمة", dataKey: "amount" },
                    { header: "تاريخ الطلب", dataKey: "date" }
                ];
                rows = (reportData.details as OperationalDetail[]).map(o => ({
                    id: o.id.slice(-6),
                    customer: o.customerName,
                    status: STATUS_MAP[o.status] || o.status,
                    amount: formatCurrency(o.totalAmount),
                    date: new Date(o.createdAt).toLocaleDateString('ar-EG')
                }));
                break;
            case "production":
                title = "تقرير الإنتاجية";
                columns = [
                    { header: "المصنع", dataKey: "name" },
                    { header: "عدد الطلبات", dataKey: "count" },
                    { header: "إجمالي القيمة", dataKey: "value" }
                ];
                rows = (reportData.details as ProductionDetail[]).map(f => ({
                    name: f.name,
                    count: f.count,
                    value: formatCurrency(f.value)
                }));
                break;
            case "users":
                title = "تقرير المستخدمين";
                columns = [
                    { header: "المستخدم ID", dataKey: "id" },
                    { header: "عدد المعاملات", dataKey: "count" },
                    { header: "حجم العمليات", dataKey: "volume" }
                ];
                rows = (reportData.details as UserDetail[]).map(u => ({
                    id: u.name || u.id,
                    count: u.transactionCount,
                    volume: formatCurrency(u.volume)
                }));
                break;
        }

        exportToPDF({
            title,
            subtitle: `الفترة من ${filters.start} إلى ${filters.end}`,
            columns,
            rows,
            fileName: `report_${reportType}_${new Date().getTime()}.pdf`
        });
        toast.success("تم بدء تحميل التقرير");
    };

    if (status === "loading" || (loading && !reportData)) {
        return (
            <div className="min-h-screen bg-background">
                <NavBar />
                <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-black animate-pulse">جاري إعداد تقاريرك المرنة...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FDFBF7] pb-24">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
                {/* Modern Header */}
                <div className="bg-card/40 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-12 border border-border/50 shadow-sm relative overflow-hidden">
                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
                    <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl" />

                    <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                                    <LayoutDashboard className="w-6 h-6" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">نظام التقارير الذكية</span>
                            </div>
                            <h2 className="text-5xl sm:text-6xl font-black tracking-tight text-foreground antialiased">
                                مركز <span className="text-gradient-gold">القرار</span>
                            </h2>
                            <p className="text-muted-foreground font-bold text-lg max-w-xl opacity-80 leading-relaxed">
                                تحكم كامل في البيانات، استعرض أداء متجرك من كافة الزوايا بمرونة مطلقة.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handlePDFExport}
                                className="h-14 px-8 rounded-2xl bg-gradient-gold text-white font-black text-sm flex items-center gap-3 shadow-gold hover:scale-105 hover:shadow-gold-lg active:scale-95 transition-all duration-300 group border border-white/10"
                            >
                                <div className="p-1.5 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
                                    <Download className="w-5 h-5 text-white" />
                                </div>
                                <span className="tracking-wide">تصدير PDF الاحترافي</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Report Type Tabs */}
                    <div className="lg:col-span-3 bg-stone-100 p-2 rounded-[2rem] border border-stone-200 flex flex-wrap gap-2 shadow-inner">
                        {[
                            { id: "financial", label: "المالية", icon: DollarSign },
                            { id: "operational", label: "التشغيل", icon: ClipboardList },
                            { id: "production", label: "الإنتاج", icon: FactoryIcon },
                            { id: "users", label: "المستخدمين", icon: UsersIcon }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setReportType(tab.id as "financial" | "operational" | "production" | "users")}
                                className={`flex-1 min-w-[120px] h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm transition-all duration-500 relative overflow-hidden group ${reportType === tab.id
                                    ? "bg-gradient-gold text-white shadow-gold scale-[1.02] border border-white/10"
                                    : "bg-transparent text-stone-600 hover:bg-white hover:text-amber-800"
                                    }`}
                            >
                                {reportType === tab.id && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
                                )}
                                <tab.icon className={`w-5 h-5 transition-transform duration-500 ${reportType === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Filter Activator / Refresh Button */}
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="bg-white p-4 rounded-3xl border border-stone-200 shadow-sm flex items-center justify-between gap-4 group hover:border-amber-600 transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-100 text-amber-900 group-hover:bg-amber-700 group-hover:text-white transition-colors">
                                <Filter className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-black text-stone-800 group-hover:text-amber-900 transition-colors">تحديث البيانات</span>
                        </div>
                        <RefreshCw
                            className={`w-5 h-5 text-stone-500 transition-all duration-700 ${loading ? 'animate-spin text-amber-700' : 'group-hover:rotate-180 group-hover:text-amber-700'}`}
                        />
                    </button>
                </div>

                {/* Advanced Filter Panel */}
                <div className="bg-white/60 backdrop-blur-sm p-8 rounded-[2rem] border border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> من تاريخ
                        </label>
                        <input
                            type="date"
                            title="تاريخ البداية"
                            aria-label="من تاريخ"
                            value={filters.start}
                            onChange={(e) => setFilters(f => ({ ...f, start: e.target.value }))}
                            className="w-full h-14 px-5 rounded-2xl bg-muted/30 border border-border focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> إلى تاريخ
                        </label>
                        <input
                            type="date"
                            title="تاريخ النهاية"
                            aria-label="إلى تاريخ"
                            value={filters.end}
                            onChange={(e) => setFilters(f => ({ ...f, end: e.target.value }))}
                            className="w-full h-14 px-5 rounded-2xl bg-muted/30 border border-border focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 flex items-center gap-2">
                            <FactoryIcon className="w-4 h-4" /> المرفق
                        </label>
                        <select
                            title="اختر المرفق"
                            aria-label="تصفية حسب المرفق"
                            value={filters.facilityId}
                            onChange={(e) => setFilters(f => ({ ...f, facilityId: e.target.value }))}
                            className="w-full h-14 px-5 rounded-2xl bg-muted/30 border border-border focus:ring-2 focus:ring-primary/20 outline-none font-bold appearance-none"
                        >
                            <option value="">جميع المرافق</option>
                            {facilities.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.type === 'FACTORY' ? 'مصنع' : 'محل'})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content Rendering */}
                {loading ? (
                    <div className="h-[400px] flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                    </div>
                ) : reportData && reportData.type === reportType && (
                    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                        {reportType === "financial" && <FinancialView data={reportData} />}
                        {reportType === "operational" && <OperationalView data={reportData} />}
                        {reportType === "production" && <ProductionView data={reportData} />}
                        {reportType === "users" && <UserActivityView data={reportData} />}
                    </div>
                )}
            </main>
        </div>
    );
}

// Sub-components for different views
function FinancialView({ data }: { data: ReportData }) {
    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCardSmall title="إجمالي الدخل" value={data.summary.totalIncome || 0} color="text-emerald-600" bg="bg-emerald-50" icon={TrendingUp} />
                <StatCardSmall title="إجمالي المصروفات" value={data.summary.totalExpense || 0} color="text-rose-600" bg="bg-rose-50" icon={Banknote} />
                <StatCardSmall title="صافي الأرباح" value={data.summary.netProfit || 0} color="text-primary" bg="bg-primary/10" icon={DollarSign} />
            </div>

            <div className="bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-8">
                <h4 className="text-xl font-black mb-6">سجل المعاملات المالية</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="border-b border-border text-[11px] font-black text-muted-foreground/60 uppercase tracking-widest">
                                <th className="pb-4 px-4">التاريخ</th>
                                <th className="pb-4 px-4">النوع</th>
                                <th className="pb-4 px-4">التصنيف</th>
                                <th className="pb-4 px-4 text-left">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {(data.details as FinancialDetail[]).map((t) => (
                                <tr key={t.id} className="group hover:bg-white/40 transition-colors">
                                    <td className="py-5 px-4 font-bold">{new Date(t.date).toLocaleDateString('ar-EG')}</td>
                                    <td className="py-5 px-4 font-black">
                                        <span className={t.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}>
                                            {t.type === "INCOME" ? "دخل" : "مصروف"}
                                        </span>
                                    </td>
                                    <td className="py-5 px-4 text-muted-foreground font-bold">{t.category}</td>
                                    <td className="py-5 px-4 font-black text-left" dir="ltr">{formatCurrency(t.amount || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function OperationalView({ data }: { data: ReportData }) {
    const STATUS_MAP: Record<string, string> = {
        "PENDING": "قيد الانتظار",
        "PROCESSING": "قيد التنفيذ",
        "COMPLETED": "مكتمل",
        "CANCELLED": "ملغي",
        "DELIVERED": "تم التسليم",
        "orders:status:registered": "قيد التسجيل",
        "orders:status:shop_ready": "جاهز للعرض",
        "orders:status:review": "المراجعة",
        "orders:status:processing": "قيد التنفيذ",
        "orders:status:delivering_to_factory": "التوصيل للمصنع",
        "orders:status:factory": "في المصنع",
        "orders:status:delivering": "التوصيل للعميل",
        "orders:status:completed": "مكتمل",
        "orders:status:cancelled": "ملغي",
        "orders:status:refused": "مرفوض"
    };

    const localizedDistribution = data.summary.statusDistribution?.map(d => ({
        ...d,
        name: STATUS_MAP[d.name] || d.name
    })) || [];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-8 h-[400px]">
                    <h4 className="text-xl font-black mb-6">توزيع حالات الطلبات</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={localizedDistribution}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                            <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                            <Bar dataKey="value" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-8 flex flex-col justify-center items-center gap-4 text-center">
                    <div className="p-6 rounded-full bg-primary/10 text-primary">
                        <Package className="w-12 h-12" />
                    </div>
                    <h5 className="text-4xl font-black">{data.summary.totalOrders}</h5>
                    <p className="text-muted-foreground font-bold">إجمالي الطلبات المنفذة</p>
                </div>
            </div>
        </div>
    );
}

function ProductionView({ data }: { data: ReportData }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(data.details as ProductionDetail[]).map((f, i) => (
                <div key={f.name} className="bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-8 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className={`p-4 rounded-2xl bg-primary/10 text-primary`}>
                            <FactoryIcon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black bg-white/50 px-3 py-1 rounded-full border border-border">#{i + 1}</span>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-2xl font-black tracking-tight">{f.name}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">الطلبات</p>
                                <p className="text-xl font-black">{f.count}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-muted-foreground uppercase opacity-60">القيمة</p>
                                <p className="text-xl font-black text-emerald-600">{formatCurrency(f.value || 0)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function UserActivityView({ data }: { data: ReportData }) {
    return (
        <div className="bg-card/40 backdrop-blur-md rounded-[2.5rem] border border-border/50 p-8 overflow-hidden">
            <h4 className="text-xl font-black mb-8">نشاط المستخدمين والنظام</h4>
            <div className="grid grid-cols-1 gap-4">
                {(data.details as UserDetail[]).map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-6 rounded-3xl bg-white/40 hover:bg-white/60 transition-all border border-transparent hover:border-primary/20 group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center font-black text-primary border border-border group-hover:bg-primary group-hover:text-white transition-all">
                                {u.id.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">المستخدم: {u.name}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{u.transactionCount} معاملة مسجلة</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-black text-emerald-600">{formatCurrency(u.volume || 0)}</p>
                            <p className="text-[10px] font-black text-muted-foreground/40 uppercase">حجم العمليات</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatCardSmall({ title, value, color, bg, icon: Icon }: { title: string; value: number; color: string; bg: string; icon: React.ElementType }) {
    return (
        <div className={`${bg} rounded-3xl p-8 border border-border/20 flex items-center justify-between gap-4`}>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">{title}</p>
                <h5 className={`text-3xl font-black ${color}`} dir="ltr">{formatCurrency(value || 0)}</h5>
            </div>
            <div className={`p-4 rounded-2xl bg-white/80 ${color} shadow-sm`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}
