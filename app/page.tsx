'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';
import { exportOrdersToPDF, type OrderExportData } from '@/lib/pdf-export';
import { ORDER_STATUS_LABELS, PRIMARY_ORDER_STATUSES } from '@/lib/constants';
import { libyaDateKey } from '@/lib/calendar-date';
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
    const filterCount = Object.values(activeFilters).filter(value => Array.isArray(value) ? value.length > 0 : Boolean(value)).length + (search ? 1 : 0);
    const clearFilters = () => { setActiveFilters({}); setSearch(''); setSearchInput(''); setDatePreset('all'); };
    const dateFilter = (value: string) => {
        setDatePreset(value);
        const start = new Date(`${libyaDateKey()}T12:00:00Z`), end = new Date(start);
        if (value === 'week') { start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 1) % 7)); end.setTime(start.getTime()); end.setUTCDate(end.getUTCDate() + 6); }
        if (value === 'month') { start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0); }
        const date = (d: Date) => d.toISOString().slice(0, 10);
        setActiveFilters(previous => ({ ...previous, startDate: value === 'all' ? '' : date(start), endDate: value === 'all' ? '' : date(end) }));
    };
    const exportPDF = async () => {
        setExporting(true);
        try {
            const data = await fetchAllPages<{ serialNumber: number; customerName: string; totalAmount: number; status: string; dueDate: string; reviewRequired?: boolean }>(`/api/orders?${queryParams}`);
            if (!data.length) { showToast('لا توجد طلبات لتصديرها', 'warning'); return; }
            const rows: OrderExportData[] = data.map(order => ({ ...order, status: `${ORDER_STATUS_LABELS[order.status] || order.status}${order.reviewRequired ? ' · يحتاج تصحيحاً' : ''}` }));
            exportOrdersToPDF(rows, 'تقرير طلبات سلطان');
            showToast('تم تصدير التقرير', 'success');
        } catch { showToast('تعذر تصدير التقرير. حاول مجدداً.', 'error'); }
        finally { setExporting(false); }
    };
    return <main className="ui-page space-y-5">
        <header className="ui-page-header">
            <div><h1 className="ui-page-title">الطلبات</h1><p className="ui-page-description">من تسجيل الطلب إلى تسليم العميل، كل مرحلة أمامك.</p></div>
            {hasPermission(PERMISSIONS.ORDERS_VIEW_FINANCIALS) && <button type="button" className="ui-button" onClick={exportPDF} disabled={exporting}><FileDown size={18} aria-hidden="true" />{exporting ? 'جاري التصدير...' : 'تصدير PDF'}</button>}
        </header>
        <section className="order-workspace-controls" aria-label="البحث وتصفية الطلبات">
            <div className="order-phase-filters" role="group" aria-label="تصفية حسب مرحلة الطلب">
                <button type="button" className="order-phase-filter" aria-pressed={!activeFilters.status?.length} onClick={() => setActiveFilters(previous => ({ ...previous, status: [] }))}><span className="order-phase-number" aria-hidden="true">الكل</span><span>جميع الطلبات</span></button>
                {PRIMARY_ORDER_STATUSES.map((phase, index) => <button type="button" key={phase} className="order-phase-filter" aria-pressed={activeFilters.status?.length === 1 && activeFilters.status[0] === phase} onClick={() => setActiveFilters(previous => ({ ...previous, status: [phase] }))}><span className="order-phase-number" aria-hidden="true">{index + 1}</span><span>{ORDER_STATUS_LABELS[phase]}</span></button>)}
            </div>
            <label className="order-mobile-phase"><span className="sr-only">حالة الطلب</span><select className="ui-field" value={activeFilters.status?.length === 1 ? activeFilters.status[0] : activeFilters.status?.length ? 'multiple' : ''} onChange={event => setActiveFilters(previous => ({ ...previous, status: event.target.value ? [event.target.value] : [] }))}><option value="">جميع مراحل الطلب</option>{activeFilters.status && activeFilters.status.length > 1 && <option value="multiple" disabled>حالات متعددة</option>}{PRIMARY_ORDER_STATUSES.map(phase => <option key={phase} value={phase}>{ORDER_STATUS_LABELS[phase]}</option>)}</select></label>
            <div className="orders-toolbar">
            <form role="search" className="flex gap-2 min-w-0" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); }}>
                <div className="relative flex-1 min-w-0"><Search size={19} className="absolute right-3 top-3 text-muted-foreground" aria-hidden="true" /><input id="orders-search" name="q" type="search" maxLength={120} value={searchInput} onChange={event => setSearchInput(event.target.value)} className="ui-field pr-10" aria-label="بحث برقم الطلب أو اسم العميل أو الهاتف" placeholder="رقم الطلب، اسم العميل، أو الهاتف" /></div>
                <button type="submit" className="ui-button ui-button-primary">بحث</button>
            </form>
                <label className="min-w-0"><span className="sr-only">موعد الاستحقاق</span><select className="ui-field" value={datePreset} onChange={event => dateFilter(event.target.value)}><option value="all">كل المواعيد</option><option value="today">استحقاق اليوم</option><option value="week">هذا الأسبوع</option><option value="month">هذا الشهر</option>{datePreset === 'custom' && <option value="custom" disabled>فترة مخصصة</option>}</select></label>
                <button type="button" className="ui-button" aria-haspopup="dialog" onClick={() => setShowFilters(true)}><SlidersHorizontal size={18} aria-hidden="true" />تصفية متقدمة{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <button className="order-quick-filter" type="button" aria-pressed={activeFilters.reviewRequired === 'true'} onClick={() => setActiveFilters(previous => ({ ...previous, reviewRequired: previous.reviewRequired === 'true' ? '' : 'true' }))}>يحتاج تصحيحاً</button>
                {hasPermission(PERMISSIONS.ORDERS_VIEW_FINANCIALS) && <button className="order-quick-filter" type="button" aria-pressed={activeFilters.paymentStatus === 'unpaid'} onClick={() => setActiveFilters(previous => ({ ...previous, paymentStatus: previous.paymentStatus === 'unpaid' ? '' : 'unpaid' }))}>له مبلغ مستحق</button>}
                <div className="ms-auto"><DateTabs activeMode={grouping} onModeChange={setGrouping} /></div>
                {hasFilters && <button type="button" className="order-clear-filters" onClick={clearFilters}><X size={15} aria-hidden="true" />مسح التصفية</button>}
            </div>
        </section>
        <OrderList queryParams={queryParams} groupingMode={grouping} onClearFilters={clearFilters} />
        {showFilters && <OrderFilters isOpen onClose={() => setShowFilters(false)} initialFilters={activeFilters} onApply={filters => { setActiveFilters(filters); setDatePreset(filters.startDate || filters.endDate ? 'custom' : 'all'); }} />}
    </main>;
}

function OrdersFromQuery() { const params = useSearchParams(); const query = params.get('q')?.slice(0, 120) || ''; return <OrdersPage key={query} initialSearch={query} />; }
export default function Home() { return <Suspense fallback={<main className="ui-page" aria-busy="true">جاري تحميل الطلبات...</main>}><OrdersFromQuery /></Suspense>; }
