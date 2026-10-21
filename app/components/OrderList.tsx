'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CalendarDays, ChevronDown, Edit3, FileText, ImageIcon, RefreshCw, ShoppingBag } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { PERMISSIONS } from '@/lib/permissions';
import { CLOSED_ORDER_STATUSES, ORDER_STATUS, normalizeOrderStatus } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { orderDueLabel } from '@/lib/calendar-date';
import { type GroupingMode } from './DateTabs';
import OrderStatusBadge from './OrderStatusBadge';

interface Order { id: string; customerName: string; customerPhone: string; totalAmount?: number; remainingAmount?: number; status: string; dueDate: string; serialNumber: number; images?: string[]; reviewRequired?: boolean; rejectionReason?: string | null; }
interface OrderPage { orders: Order[]; nextCursor: string | null; }

export default function OrderList({ queryParams = '', groupingMode = 'none', onClearFilters }: { queryParams?: string; groupingMode?: GroupingMode; onClearFilters?: () => void }) {
    return <OrderResults key={queryParams} queryParams={queryParams} groupingMode={groupingMode} onClearFilters={onClearFilters} />;
}

function OrderResults({ queryParams, groupingMode, onClearFilters }: { queryParams: string; groupingMode: GroupingMode; onClearFilters?: () => void }) {
    const { data: session } = useSession();
    const [result, setResult] = useState<OrderPage>({ orders: [], nextCursor: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const top = useRef<HTMLElement>(null);
    const can = (permission: string) => Boolean(session?.user?.role === 'ADMIN' || session?.user?.permissions?.includes(permission));
    const canViewFinancials = can(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

    useEffect(() => {
        const abort = new AbortController();
        let active = true;
        const timeout = setTimeout(() => abort.abort(), 20000);
        async function load() {
            setLoading(true); setError('');
            try {
                const params = new URLSearchParams(queryParams); params.set('limit', '100');
                const response = await fetch(`/api/orders?${params}`, { signal: abort.signal, cache: 'no-store' });
                if (!response.ok) throw new Error('تعذر تحميل الطلبات. تحقق من الاتصال وصلاحية الدخول.');
                const orders: unknown = await response.json();
                if (!Array.isArray(orders)) throw new Error('تعذر قراءة قائمة الطلبات.');
                if (active) { setResult({ orders, nextCursor: response.headers.get('X-Next-Cursor') }); setPage(1); }
            } catch (reason) {
                if (active) setError(abort.signal.aborted ? 'استغرقت الاستجابة وقتاً طويلاً. يمكنك إعادة تحميل الطلبات.' : reason instanceof Error ? reason.message : 'تعذر تحميل الطلبات.');
            } finally { clearTimeout(timeout); if (active) setLoading(false); }
        }
        void load();
        return () => { active = false; clearTimeout(timeout); abort.abort(); };
    }, [queryParams, retry]);

    const loadMore = async () => {
        if (!result.nextCursor || loadingMore) return;
        setLoadingMore(true); setError('');
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 20000);
        try {
            const params = new URLSearchParams(queryParams); params.set('limit', '100'); params.set('cursor', result.nextCursor);
            const response = await fetch(`/api/orders?${params}`, { signal: abort.signal, cache: 'no-store' });
            if (!response.ok) throw new Error();
            const orders: Order[] = await response.json();
            if (!Array.isArray(orders)) throw new Error();
            setResult(previous => ({ orders: [...previous.orders, ...orders], nextCursor: response.headers.get('X-Next-Cursor') }));
        } catch { setError('تعذر تحميل بقية الطلبات. الطلبات الظاهرة محفوظة ويمكنك المحاولة مجدداً.'); }
        finally { clearTimeout(timeout); setLoadingMore(false); }
    };
    const pageSize = 20;
    const pages = Math.max(1, Math.ceil(result.orders.length / pageSize));
    const changePage = (next: number) => { setPage(next); top.current?.scrollIntoView({ block: 'start' }); };
    const groups = useMemo(() => {
        const grouped: Record<string, Order[]> = {};
        result.orders.slice((page - 1) * pageSize, page * pageSize).forEach(order => {
            const date = new Date(order.dueDate);
            let key = 'الطلبات';
            if (groupingMode === 'day') key = date.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            if (groupingMode === 'month') key = date.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli', month: 'long', year: 'numeric' });
            if (groupingMode === 'week') { date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 1) % 7)); const end = new Date(date); end.setUTCDate(end.getUTCDate() + 6); key = `أسبوع ${date.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' })} – ${end.toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' })}`; }
            (grouped[key] ||= []).push(order);
        });
        return grouped;
    }, [result.orders, page, groupingMode]);

    if (loading) return <section role="status" aria-busy="true" aria-label="جاري تحميل الطلبات" className="space-y-4"><span className="sr-only">جاري تحميل الطلبات...</span><div className="orders-grid" aria-hidden="true">{[0, 1, 2].map(index => <div key={index} className="ui-card order-skeleton"><div className="skeleton-line w-1/3" /><div className="skeleton-line w-2/3" /><div className="skeleton-line w-1/2" /><div className="skeleton-line h-16" /><div className="skeleton-line w-3/4" /></div>)}</div></section>;
    return <section ref={top} className="space-y-5 scroll-mt-24" aria-label="نتائج الطلبات">
        {error && <div role="alert" className="ui-feedback ui-feedback-error"><AlertCircle size={20} aria-hidden="true" /><div className="flex-1"><h2 className="font-semibold">تعذر إكمال التحميل</h2><p className="text-sm mt-1">{error}</p></div><button type="button" className="ui-button" onClick={() => result.orders.length ? void loadMore() : setRetry(value => value + 1)}>إعادة المحاولة</button></div>}
        {!error && !result.orders.length && <div className="ui-card empty-state"><span className="empty-state-icon"><ShoppingBag size={28} aria-hidden="true" /></span><h2 className="text-lg font-semibold">{queryParams ? 'لا توجد طلبات مطابقة' : 'أول طلب يبدأ من هنا'}</h2><p className="text-sm text-muted-foreground max-w-sm">{queryParams ? 'غيّر المرحلة أو الموعد، أو امسح التصفية لعرض بقية الطلبات.' : 'سجّل بيانات العميل، واختر المصنع والموعد، ثم تابع الطلب حتى التسليم.'}</p>{queryParams && onClearFilters ? <button className="ui-button" onClick={onClearFilters}>مسح التصفية</button> : can(PERMISSIONS.ORDERS_ADD) && <Link href="/orders/new" className="ui-button ui-button-primary">إضافة أول طلب<ArrowLeft size={17} aria-hidden="true" /></Link>}</div>}
        {result.orders.length > 0 && <div className="flex items-center justify-between gap-3 text-sm"><p className="text-muted-foreground" aria-live="polite">عرض {((page - 1) * pageSize + 1).toLocaleString('ar-LY')}–{Math.min(page * pageSize, result.orders.length).toLocaleString('ar-LY')} من {result.orders.length.toLocaleString('ar-LY')} طلباً محمّلاً{result.nextCursor ? ' · توجد طلبات إضافية' : ''}</p><button type="button" className="ui-button order-refresh" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />تحديث</button></div>}
        {Object.entries(groups).map(([title, orders]) => { const cards = orders.map(order => {
            const phase = normalizeOrderStatus(order.status);
            const closed = CLOSED_ORDER_STATUSES.includes(order.status);
            const due = orderDueLabel(order.dueDate);
            const overdue = due.overdue && !closed && phase !== ORDER_STATUS.COMPLETED;
            const next = closed ? 'القرار والتسوية في تفاصيل الطلب' : order.reviewRequired ? 'راجع ملاحظة المصنع قبل المتابعة' : phase === ORDER_STATUS.REGISTERED ? 'بانتظار بدء التجهيز في المصنع' : phase === ORDER_STATUS.PROCESSING ? 'يتابع المصنع التجهيز' : phase === ORDER_STATUS.SHOP_READY ? 'بانتظار تسليم المحل للعميل' : 'اكتمل التسليم للعميل';
            return <article key={order.id} className="order-card" data-review={order.reviewRequired || undefined}>
                <div className="order-card-top"><Link className="order-number" href={`/orders/${order.id}`} aria-label={`تفاصيل الطلب ${order.serialNumber}`}><bdi>#{order.serialNumber}</bdi></Link><OrderStatusBadge status={order.status} /></div>
                <div className="min-w-0"><h3 className="order-customer"><Link href={`/orders/${order.id}`}>{order.customerName}</Link></h3><p className="text-sm text-muted-foreground mt-1"><bdi>{order.customerPhone}</bdi></p></div>
                {order.reviewRequired && <p className="order-review-note"><AlertCircle size={16} aria-hidden="true" /><span><strong>يحتاج تصحيحاً</strong>{order.rejectionReason && <> · {order.rejectionReason}</>}</span></p>}
                <div className="order-due" data-overdue={overdue || undefined}><CalendarDays size={17} aria-hidden="true" /><span>{overdue ? 'تجاوز موعده · ' : ''}{due.label}</span>{Boolean(order.images?.length) && <span className="order-image-count"><ImageIcon size={14} aria-hidden="true" />{order.images!.length}<span className="sr-only"> صور مرفقة</span></span>}</div>
                {canViewFinancials && <dl className="order-card-money"><div><dt>قيمة الطلب</dt><dd><bdi>{formatCurrency(order.totalAmount || 0)}</bdi></dd></div><div><dt>{closed ? 'التسوية منفصلة' : (order.remainingAmount || 0) > 0 ? 'المتبقي للتحصيل' : 'مدفوع بالكامل'}</dt><dd className={closed ? '' : (order.remainingAmount || 0) > 0 ? 'text-amber-900' : 'text-emerald-800'}><bdi>{closed ? 'طلب مغلق' : formatCurrency(order.remainingAmount || 0)}</bdi></dd></div></dl>}
                <p className="order-next-step">{next}</p>
                <div className="order-card-footer"><Link className="order-open" href={`/orders/${order.id}`}>فتح الطلب<ArrowLeft size={17} aria-hidden="true" /></Link><div className="flex gap-1">{canViewFinancials && <Link href={`/orders/print/${order.id}`} target="_blank" rel="noopener" className="ui-icon-button" aria-label={`طباعة الطلب ${order.serialNumber}`} title="مستند الطلب"><FileText size={17} aria-hidden="true" /></Link>}{can(PERMISSIONS.ORDERS_EDIT) && !closed && <Link href={`/orders/${order.id}/edit`} className="ui-icon-button" aria-label={`تعديل الطلب ${order.serialNumber}`} title="تعديل الطلب"><Edit3 size={17} aria-hidden="true" /></Link>}</div></div>
            </article>;
        }); return groupingMode === 'none' ? <div key={title} className="orders-grid">{cards}</div> : <details open key={title} className="order-group"><summary className="order-group-title"><ChevronDown size={18} aria-hidden="true" /><h2>{title}</h2><span>{orders.length.toLocaleString('ar-LY')}</span></summary><div className="orders-grid">{cards}</div></details>; })}
        {(pages > 1 || result.nextCursor) && <nav aria-label="صفحات الطلبات" className="orders-pagination"><button type="button" className="ui-button" disabled={page === 1} onClick={() => changePage(page - 1)}>السابق</button><span className="text-sm" aria-live="polite">الصفحة {page} من {pages}</span><button type="button" className="ui-button" disabled={page === pages} onClick={() => changePage(page + 1)}>التالي</button>{result.nextCursor && <button type="button" className="ui-button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'جاري التحميل...' : 'تحميل طلبات إضافية'}</button>}</nav>}
    </section>;
}
