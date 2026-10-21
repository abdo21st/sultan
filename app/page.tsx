'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';
import { exportOrdersToPDF, type OrderExportData } from '@/lib/pdf-export';
import { ORDER_STATUS_LABELS, ORDER_STATUS } from '@/lib/constants';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import { useToast } from './components/ToastProvider';
import OrderList from './components/OrderList';
import DateTabs, { type GroupingMode } from './components/DateTabs';
import OrderFilters, { type FilterState } from './components/OrderFilters';

function OrdersPage({ initialSearch }: { initialSearch: string }) {
    const { hasPermission } = usePermission();
    const { showToast } = useToast();
    const [showFilters, setShowFilters] = useState(false);
    const [searchInput, setSearchInput] = useState(initialSearch);
    const [search, setSearch] = useState(initialSearch);
    const [exporting, setExporting] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Partial<FilterState>>({});
    const [grouping, setGrouping] = useState<GroupingMode>('none');
    const [datePreset, setDatePreset] = useState('all');
    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        if (search) params.set('q', search);
        Object.entries(activeFilters).forEach(([key, value]) => {
            if (Array.isArray(value)) { if (value.length) params.set(key, value.join(',')); }
            else if (value) params.set(key, value);
        });
        return params.toString();
    }, [activeFilters, search]);
    const hasFilters = Boolean(queryParams);
    const dateFilter = (value: string) => {
        setDatePreset(value);
        const start = new Date(), end = new Date();
        if (value === 'week') { start.setDate(start.getDate() - ((start.getDay() + 1) % 7)); end.setTime(start.getTime()); end.setDate(end.getDate() + 6); }
        if (value === 'month') { start.setDate(1); end.setMonth(end.getMonth() + 1, 0); }
        const date = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        setActiveFilters(previous => ({ ...previous, startDate: value === 'all' ? '' : date(start), endDate: value === 'all' ? '' : date(end) }));
    };
    const exportPDF = async () => {
        setExporting(true);
        try {
            const data = await fetchAllPages<{ serialNumber: number; customerName: string; totalAmount: number; status: string; dueDate: string }>(`/api/orders?${queryParams}`);
            if (!data.length) { showToast('لا توجد طلبات لتصديرها', 'warning'); return; }
            const rows: OrderExportData[] = data.map(order => ({ ...order, status: ORDER_STATUS_LABELS[order.status] || order.status }));
            exportOrdersToPDF(rows, 'تقرير طلبات سلطان');
            showToast('تم تصدير التقرير', 'success');
        } catch { showToast('تعذر تصدير التقرير. حاول مجدداً.', 'error'); }
        finally { setExporting(false); }
    };
    return <main className="ui-page space-y-5">
        <header className="ui-page-header">
            <div><h1 className="ui-page-title">الطلبات</h1><p className="ui-page-description">متابعة التنفيذ والتسليم والتحصيل.</p></div>
            {hasPermission(PERMISSIONS.ORDERS_VIEW_FINANCIALS) && <button type="button" className="ui-button" onClick={exportPDF} disabled={exporting}><FileDown size={18} aria-hidden="true" />{exporting ? 'جاري التصدير...' : 'تصدير PDF'}</button>}
        </header>
        <section className="ui-card space-y-4" aria-label="البحث وتصفية الطلبات">
            <form role="search" className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); }}>
                <div className="relative flex-1 min-w-0"><Search size={19} className="absolute right-3 top-3 text-muted-foreground" aria-hidden="true" /><input id="orders-search" name="q" type="search" maxLength={120} value={searchInput} onChange={event => setSearchInput(event.target.value)} className="ui-field pr-10" aria-label="بحث برقم الطلب أو اسم العميل أو الهاتف" placeholder="رقم الطلب، اسم العميل، أو الهاتف" /></div>
                <button type="submit" className="ui-button ui-button-primary">بحث</button>
            </form>
            <div className="grid grid-cols-2 lg:flex lg:flex-wrap items-end gap-3">
                <label className="min-w-0 lg:w-52"><span className="ui-field-label">حالة الطلب</span><select className="ui-field" value={activeFilters.status?.length === 1 ? activeFilters.status[0] : activeFilters.status?.length ? 'multiple' : ''} onChange={event => setActiveFilters(previous => ({ ...previous, status: event.target.value ? [event.target.value] : [] }))}><option value="">جميع الحالات</option>{activeFilters.status && activeFilters.status.length > 1 && <option value="multiple" disabled>حالات متعددة</option>}{Object.entries(ORDER_STATUS_LABELS).filter(([key]) => (Object.values(ORDER_STATUS) as readonly string[]).includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label className="min-w-0 lg:w-44"><span className="ui-field-label">موعد الاستحقاق</span><select className="ui-field" value={datePreset} onChange={event => dateFilter(event.target.value)}><option value="all">كل المواعيد</option><option value="today">اليوم</option><option value="week">هذا الأسبوع</option><option value="month">هذا الشهر</option>{datePreset === 'custom' && <option value="custom" disabled>فترة مخصصة</option>}</select></label>
                <button type="button" className="ui-button col-span-2 lg:col-span-1" aria-haspopup="dialog" onClick={() => setShowFilters(true)}><SlidersHorizontal size={18} aria-hidden="true" />تصفية متقدمة</button>
                {hasFilters && <button type="button" className="ui-button" onClick={() => { setActiveFilters({}); setSearch(''); setSearchInput(''); setDatePreset('all'); }}><X size={16} aria-hidden="true" />مسح التصفية</button>}
            </div>
        </section>
        <DateTabs activeMode={grouping} onModeChange={setGrouping} />
        <OrderList queryParams={queryParams} groupingMode={grouping} />
        {showFilters && <OrderFilters isOpen onClose={() => setShowFilters(false)} initialFilters={activeFilters} onApply={filters => { setActiveFilters(filters); setDatePreset(filters.startDate || filters.endDate ? 'custom' : 'all'); }} />}
    </main>;
}

function OrdersFromQuery() { const params = useSearchParams(); const query = params.get('q')?.slice(0, 120) || ''; return <OrdersPage key={query} initialSearch={query} />; }
export default function Home() { return <Suspense fallback={<main className="ui-page" aria-busy="true">جاري تحميل الطلبات...</main>}><OrdersFromQuery /></Suspense>; }
