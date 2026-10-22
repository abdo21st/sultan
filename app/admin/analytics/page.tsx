"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BarChart, Bar, CartesianGrid, Tooltip, ResponsiveContainer, XAxis, YAxis
} from "recharts";
import {
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
import { exportToPDF } from "@/lib/pdf-export";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { PERMISSIONS } from '@/lib/permissions';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { transactionCategoryLabel } from '@/lib/transaction-category';

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
    reversalOfId?: string | null;
    reversalReason?: string | null;
}

interface OperationalDetail {
    reviewRequired?: boolean;
    rejectionReason?: string | null;
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
        netCashFlow?: number;
        totalOrders?: number;
        completedOrders?: number;
        openOrders?: number;
        correctionOrders?: number;
        statusDistribution?: { name: string; value: number }[];
        orderPayments?: number;
        topFactory?: string;
    };
    details: (FinancialDetail | OperationalDetail | ProductionDetail | UserDetail)[];
    nextCursor?: string | null;
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
    const [loadingMore, setLoadingMore] = useState(false);
    const [reportError, setReportError] = useState('');

    const permissions = session?.user?.permissions ?? [];
    const isAuthorized = status === 'authenticated' && permissions.includes(PERMISSIONS.DASHBOARD_VIEW);
    const showAmounts = permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);
    const canReadFinancial = showAmounts && permissions.includes(PERMISSIONS.TRANSACTIONS_VIEW);
    const allFacilities = session?.user?.role === 'ADMIN' || permissions.includes(PERMISSIONS.FACILITIES_VIEW_ALL);
    const effectiveReportType = canReadFinancial ? reportType : (reportType === 'financial' || reportType === 'users' ? 'operational' : reportType);

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
                .then(data => setFacilities(Array.isArray(data) ? data : []))
                .catch(console.error);
        }
    }, [isAuthorized]);

    // Fetch Report Data
    const fetchReport = useCallback(async () => {
        setLoading(true);
        setReportError('');
        try {
            const query = new URLSearchParams({
                type: effectiveReportType,
                start: filters.start,
                end: filters.end,
                limit: "50",
                ...(filters.facilityId && { facilityId: filters.facilityId })
            });
            const res = await fetch(`/api/admin/reports?${query}`);
            if (!res.ok) throw new Error("تعذر تحميل التقرير.");
            const data = await res.json();
            setReportData(data);
        } catch (err) {
            setReportData(null);
            setReportError('تعذر تحميل التقرير. تحقق من الاتصال ثم أعد المحاولة.');
            toast.error("فشل تحميل بيانات التقرير");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [effectiveReportType, filters]);

    const loadMoreReport = useCallback(async () => {
        if (!reportData?.nextCursor || loadingMore) return;
        setLoadingMore(true);
        try {
            const query = new URLSearchParams({
                type: effectiveReportType,
                start: filters.start,
                end: filters.end,
                limit: "50",
                cursor: reportData.nextCursor,
                ...(filters.facilityId && { facilityId: filters.facilityId })
            });
            const response = await fetch(`/api/admin/reports?${query}`, { cache: "no-store" });
            if (!response.ok) throw new Error("تعذر تحميل بقية التقرير.");
            const page: ReportData = await response.json();
            setReportData((current) => current ? {
                ...current,
                details: [...current.details, ...page.details],
                nextCursor: page.nextCursor ?? null,
            } : page);
        } catch {
            toast.error("فشل تحميل بقية التقرير");
        } finally {
            setLoadingMore(false);
        }
    }, [reportData, loadingMore, effectiveReportType, filters]);

    useEffect(() => {
        if (isAuthorized) {
            fetchReport();
        }
    }, [isAuthorized, fetchReport]);

    // PDF Export Logic
    const STATUS_MAP: Record<string, string> = { ...ORDER_STATUS_LABELS, System: 'النظام' };

    const handlePDFExport = async () => {
        if (!reportData) return;

        let exportDetails = [...reportData.details];
        let cursor = reportData.nextCursor ?? null;
        try {
            while (cursor) {
                const query = new URLSearchParams({
                    type: effectiveReportType,
                    start: filters.start,
                    end: filters.end,
                    limit: "100",
                    cursor,
                    ...(filters.facilityId && { facilityId: filters.facilityId })
                });
                const response = await fetch(`/api/admin/reports?${query}`, { cache: "no-store" });
                if (!response.ok) throw new Error("تعذر تحميل بقية التقرير.");
                const page: ReportData = await response.json();
                exportDetails = exportDetails.concat(page.details);
                cursor = page.nextCursor ?? null;
            }
        } catch {
            toast.error("تعذر تحميل التقرير كاملًا للتصدير");
            return;
        }

        let columns: { header: string; dataKey: string }[] = [];
        let rows: Record<string, string | number>[] = [];
        let title = "";

        switch (effectiveReportType) {
            case "financial":
                title = "التقرير المالي";
                columns = [
                    { header: "التاريخ", dataKey: "date" },
                    { header: "النوع", dataKey: "type" },
                    { header: "التصنيف", dataKey: "category" },
                    { header: "المبلغ", dataKey: "amount" },
                    { header: "البيان", dataKey: "description" }
                ];
                rows = (exportDetails as FinancialDetail[]).map(t => ({
                    date: new Date(t.date).toLocaleDateString('ar-EG'),
                    type: `${t.reversalOfId ? 'قيد عكسي / ' : ''}${t.type === "INCOME" ? "دخل" : "مصروف"}`,
                    category: transactionCategoryLabel(t.category),
                    amount: formatCurrency(t.amount),
                    description: t.reversalReason || t.description || ""
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
                rows = (exportDetails as OperationalDetail[]).map(o => ({
                    id: o.id.slice(-6),
                    customer: o.customerName,
                    status: `${STATUS_MAP[o.status] || o.status}${o.reviewRequired ? ' · يحتاج تصحيحاً' : ''}`,
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
                rows = (exportDetails as ProductionDetail[]).map(f => ({
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
                rows = (exportDetails as UserDetail[]).map(u => ({
                    id: u.name || u.id,
                    count: u.transactionCount,
                    volume: formatCurrency(u.volume)
                }));
                break;
        }

        if (!showAmounts) columns = columns.filter(column => !['amount', 'value', 'volume'].includes(column.dataKey));

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
            <div className="min-h-full bg-background">

                <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-muted-foreground font-semibold animate-pulse">جاري تحميل التقارير...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-background pb-24">

            <main className="ui-page space-y-5">
                <header className="ui-page-header">
                    <div><h1 className="ui-page-title">التقارير والتحليلات</h1><p className="ui-page-description">الحركات المالية والطلبات حسب الحالة والمصنع، ضمن نطاق صلاحياتك.</p></div>
                    <button type="button" onClick={handlePDFExport} className="ui-button"><Download size={18} aria-hidden="true" />تصدير PDF</button>
                </header>

                {/* Filters Row */}
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Report Type Tabs */}
                    <div className="ui-tabs flex-1">
                        {[
                            { id: "financial", label: "المالية", icon: DollarSign },
                            { id: "operational", label: "التشغيل", icon: ClipboardList },
                            { id: "production", label: "الإنتاج", icon: FactoryIcon },
                            { id: "users", label: "نشاط تسجيل الحركات", icon: UsersIcon }
                        ].filter(tab => canReadFinancial || !['financial', 'users'].includes(tab.id)).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setReportType(tab.id as "financial" | "operational" | "production" | "users")}
                                aria-pressed={effectiveReportType === tab.id}
                                className="ui-tab flex-1"
                            >
                                <tab.icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Filter Activator / Refresh Button */}
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="ui-button disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="text-primary">
                                <Filter className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-semibold text-foreground transition-colors">تحديث البيانات</span>
                        </div>
                        <RefreshCw
                            className={`w-5 h-5 text-muted-foreground transition-all duration-700 ${loading ? 'animate-spin text-primary' : ''}`}
                        />
                    </button>
                </div>

                {/* Advanced Filter Panel */}
                <div className="ui-card grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase  text-muted-foreground px-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> من تاريخ
                        </label>
                        <input
                            type="date"
                            title="تاريخ البداية"
                            aria-label="من تاريخ"
                            value={filters.start}
                            onChange={(e) => setFilters(f => ({ ...f, start: e.target.value }))}
                            className="ui-field"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase  text-muted-foreground px-2 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> إلى تاريخ
                        </label>
                        <input
                            type="date"
                            title="تاريخ النهاية"
                            aria-label="إلى تاريخ"
                            value={filters.end}
                            onChange={(e) => setFilters(f => ({ ...f, end: e.target.value }))}
                            className="ui-field"
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase  text-muted-foreground px-2 flex items-center gap-2">
                            <FactoryIcon className="w-4 h-4" /> المنشأة
                        </label>
                        <select
                            title="اختر المنشأة"
                            aria-label="تصفية حسب المنشأة"
                            value={filters.facilityId}
                            onChange={(e) => setFilters(f => ({ ...f, facilityId: e.target.value }))}
                            className="ui-field appearance-none"
                        >
                            <option value="">{allFacilities ? 'جميع المنشآت' : 'منشأتي'}</option>
                            {facilities.filter(f => allFacilities || f.id === session?.user?.facilityId).map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.type === 'FACTORY' ? 'مصنع' : 'محل'})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Content Rendering */}
                {reportError && <div className="ui-card flex flex-wrap items-center justify-between gap-3" role="alert"><p>{reportError}</p><button type="button" onClick={fetchReport} className="ui-button">إعادة المحاولة</button></div>}
                {loading ? (
                    <div className="h-[400px] flex items-center justify-center">
                        <Loader2 className="w-10 h-10 animate-spin text-primary/40" />
                    </div>
                ) : reportData && reportData.type === effectiveReportType && (
                    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
                        {effectiveReportType === "financial" && <FinancialView data={reportData} />}
                        {effectiveReportType === "operational" && <OperationalView data={reportData} />}
                        {effectiveReportType === "production" && <ProductionView data={reportData} showAmounts={showAmounts} />}
                        {effectiveReportType === "users" && <UserActivityView data={reportData} />}
                        {reportData.nextCursor && (
                            <div className="flex justify-center pt-8">
                                <button
                                    onClick={loadMoreReport}
                                    disabled={loadingMore}
                                    className="min-h-12 px-8 rounded-xl border border-border bg-card font-bold text-foreground hover:border-primary disabled:opacity-60"
                                >
                                    {loadingMore ? "جاري تحميل المزيد..." : "تحميل المزيد من السجلات"}
                                </button>
                            </div>
                        )}
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
                <StatCardSmall title="صافي الدخل" value={data.summary.totalIncome || 0} color="text-emerald-600" bg="bg-emerald-50" icon={TrendingUp} />
                <StatCardSmall title="صافي المصروفات" value={data.summary.totalExpense || 0} color="text-rose-600" bg="bg-rose-50" icon={Banknote} />
                <StatCardSmall title="صافي التدفق النقدي" value={data.summary.netCashFlow ?? data.summary.netProfit ?? 0} color="text-primary" bg="bg-primary/10" icon={DollarSign} />
            </div>
            <p className="text-sm text-muted-foreground">صافي التدفق النقدي = الدخل المسجل ناقص المصروفات المسجلة خلال الفترة، مع أثر القيود العكسية. لا يمثل ربح الإنتاج أو تكلفة المخزون غير المسجلة.</p>

            <div className="bg-card  rounded-xl border border-border p-5">
                <h4 className="text-xl font-semibold mb-6">سجل الحركات المالية</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase ">
                                <th className="pb-4 px-4">التاريخ</th>
                                <th className="pb-4 px-4">النوع</th>
                                <th className="pb-4 px-4">التصنيف</th>
                                <th className="pb-4 px-4 text-left">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {(data.details as FinancialDetail[]).map((t) => (
                                <tr key={t.id} className="group hover:bg-card transition-colors">
                                    <td className="py-5 px-4 font-bold">{new Date(t.date).toLocaleDateString('ar-EG')}</td>
                                    <td className="py-5 px-4 font-semibold">
                                        <span className={t.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}>
                                            {t.reversalOfId ? 'قيد عكسي / ' : ''}{t.type === "INCOME" ? "دخل" : "مصروف"}
                                        </span>
                                    </td>
                                    <td className="py-5 px-4 text-muted-foreground font-bold">{transactionCategoryLabel(t.category)}</td>
                                    <td className="py-5 px-4 font-semibold text-left" dir="ltr">{formatCurrency(t.amount || 0)}</td>
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
    const STATUS_MAP: Record<string, string> = { ...ORDER_STATUS_LABELS, System: 'النظام' };

    const localizedDistribution = data.summary.statusDistribution?.map(d => ({
        ...d,
        name: STATUS_MAP[d.name] || d.name
    })) || [];

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-card  rounded-xl border border-border p-5 h-[400px]">
                    <h4 className="text-xl font-semibold mb-6">توزيع حالات الطلبات</h4>
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
                <div className="bg-card  rounded-xl border border-border p-5 flex flex-col justify-center items-center gap-4 text-center">
                    <div className="p-6 rounded-full bg-primary/10 text-primary">
                        <Package className="w-12 h-12" />
                    </div>
                    <h5 className="text-4xl font-semibold">{data.summary.totalOrders}</h5>
                    <p className="text-muted-foreground font-bold">إجمالي الطلبات المسجلة</p>
                    <p className="text-sm">المكتملة: {data.summary.completedOrders ?? 0} · قيد المتابعة: {data.summary.openOrders ?? 0}</p>
                    <p className="text-sm text-primary">يحتاج تصحيحاً: {data.summary.correctionOrders ?? 0} — علامة مستقلة عن المرحلة</p>
                </div>
            </div>
        </div>
    );
}

function ProductionView({ data, showAmounts }: { data: ReportData; showAmounts: boolean }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(data.details as ProductionDetail[]).map((f, i) => (
                <div key={f.name} className="bg-card  rounded-xl border border-border p-5 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className={`p-4 rounded-xl bg-primary/10 text-primary`}>
                            <FactoryIcon className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-semibold bg-card/50 px-3 py-1 rounded-full border border-border">#{i + 1}</span>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-2xl font-semibold ">{f.name}</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase opacity-60">الطلبات</p>
                                <p className="text-xl font-semibold">{f.count}</p>
                            </div>
                            {showAmounts && <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase opacity-60">القيمة الأصلية للطلبات</p>
                                <p className="text-xl font-semibold text-emerald-600">{formatCurrency(f.value || 0)}</p>
                            </div>}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function UserActivityView({ data }: { data: ReportData }) {
    return (
        <div className="bg-card  rounded-xl border border-border p-5 overflow-hidden">
            <h4 className="text-xl font-semibold mb-3">نشاط تسجيل الحركات المالية</h4>
            <p className="text-sm text-muted-foreground mb-6">عدد وقيمة الحركات التي سجلها كل مستخدم؛ لا يقيس الحضور أو ساعات العمل أو أداء الإنتاج.</p>
            <div className="grid grid-cols-1 gap-4">
                {(data.details as UserDetail[]).map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-6 rounded-xl bg-card hover:bg-card/60 transition-all border border-transparent hover:border-primary/20 group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center font-semibold text-primary border border-border group-hover:bg-primary group-hover:text-white transition-all">
                                {u.id.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">المستخدم: {u.name}</p>
                                <p className="text-xs font-bold text-muted-foreground uppercase ">{u.transactionCount} معاملة مسجلة</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-semibold text-emerald-600">{formatCurrency(u.volume || 0)}</p>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">حجم العمليات</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StatCardSmall({ title, value, color, icon: Icon }: { title: string; value: number; color: string; bg: string; icon: React.ElementType }) {
    return (
        <div className={`ui-card flex items-center justify-between gap-4`}>
            <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase ">{title}</p>
                <h5 className={`text-3xl font-semibold ${color}`} dir="ltr">{formatCurrency(value || 0)}</h5>
            </div>
            <div className={`p-4 rounded-xl bg-card ${color} `}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}
