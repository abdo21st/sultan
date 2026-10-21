'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Calendar, ChevronDown, Edit3, FileText, ShoppingBag } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { PERMISSIONS } from '@/lib/permissions';
import { CLOSED_ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import { type GroupingMode } from './DateTabs';

interface Order { id: string; customerName: string; customerPhone: string; totalAmount?: number; remainingAmount?: number; status: string; dueDate: string; serialNumber: number; images?: string[]; }
interface OrderPage { orders: Order[]; nextCursor: string | null; }

export default function OrderList({ queryParams = '', groupingMode = 'none' }: { queryParams?: string; groupingMode?: GroupingMode }) {
    return <OrderResults key={queryParams} queryParams={queryParams} groupingMode={groupingMode} />;
}

function OrderResults({ queryParams, groupingMode }: { queryParams: string; groupingMode: GroupingMode }) {
    const { data: session } = useSession();
    const [result, setResult] = useState<OrderPage>({ orders: [], nextCursor: null });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const can = (permission: string) => Boolean(session?.user?.role === 'ADMIN' || session?.user?.permissions?.includes(permission));
    const canViewFinancials = can(PERMISSIONS.ORDERS_VIEW_FINANCIALS);

    useEffect(() => {
        const abort = new AbortController();
        async function load() {
            setLoading(true); setError('');
            try {
                const params = new URLSearchParams(queryParams); params.set('limit', '100');
                const response = await fetch(`/api/orders?${params}`, { signal: abort.signal });
                if (!response.ok) throw new Error('تعذر تحميل الطلبات. تحقق من الاتصال وصلاحية الدخول.');
                const orders: unknown = await response.json();
                if (!Array.isArray(orders)) throw new Error('تعذر قراءة قائمة الطلبات.');
                if (!abort.signal.aborted) { setResult({ orders, nextCursor: response.headers.get('X-Next-Cursor') }); setPage(1); }
            } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الطلبات.'); }
            finally { if (!abort.signal.aborted) setLoading(false); }
        }
        void load();
        return () => abort.abort();
    }, [queryParams, retry]);

    const loadMore = async () => {
        if (!result.nextCursor || loadingMore) return;
        setLoadingMore(true); setError('');
        try {
            const params = new URLSearchParams(queryParams); params.set('limit', '100'); params.set('cursor', result.nextCursor);
            const response = await fetch(`/api/orders?${params}`);
            if (!response.ok) throw new Error('تعذر تحميل بقية الطلبات.');
            const orders: Order[] = await response.json();
            if (!Array.isArray(orders)) throw new Error('تعذر قراءة بقية الطلبات.');
            setResult(previous => ({ orders: [...previous.orders, ...orders], nextCursor: response.headers.get('X-Next-Cursor') }));
        } catch { setError('تعذر تحميل بقية الطلبات. يمكنك المحاولة مجدداً.'); }
        finally { setLoadingMore(false); }
    };
    const pageSize = 20;
    const pages = Math.max(1, Math.ceil(result.orders.length / pageSize));
    const groups = useMemo(() => {
        const grouped: Record<string, Order[]> = {};
        result.orders.slice((page - 1) * pageSize, page * pageSize).forEach(order => {
            const date = new Date(order.dueDate);
            let key = 'الطلبات';
            if (groupingMode === 'day') key = date.toLocaleDateString('ar-LY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            if (groupingMode === 'month') key = date.toLocaleDateString('ar-LY', { month: 'long', year: 'numeric' });
            if (groupingMode === 'week') { date.setDate(date.getDate() - ((date.getDay() + 1) % 7)); const end = new Date(date); end.setDate(end.getDate() + 6); key = `أسبوع ${date.toLocaleDateString('ar-LY')} – ${end.toLocaleDateString('ar-LY')}`; }
            (grouped[key] ||= []).push(order);
        });
        return grouped;
    }, [result.orders, page, groupingMode]);

    if (loading) return <div className="ui-card text-sm text-muted-foreground" role="status" aria-busy="true">جاري تحميل الطلبات...</div>;
    return <section className="space-y-5" aria-label="نتائج الطلبات">
        {error && <div role="alert" className="ui-card flex flex-wrap justify-between gap-3"><span>{error}</span><button type="button" className="ui-button" onClick={() => result.orders.length ? void loadMore() : setRetry(value => value + 1)}>إعادة المحاولة</button></div>}
        {!error && !result.orders.length && <div className="ui-card text-center py-10"><ShoppingBag size={32} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" /><h2 className="text-lg font-semibold">{queryParams ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات بعد'}</h2><p className="mt-2 text-sm text-muted-foreground">{queryParams ? 'جرّب تعديل البحث أو مسح التصفية.' : 'ابدأ بإضافة أول طلب من زر طلب جديد.'}</p></div>}
        {Object.entries(groups).map(([title, orders]) => <details open key={title} className="group space-y-3"><summary className="flex items-center gap-2 cursor-pointer list-none rounded-lg py-2 focus-visible:outline"><ChevronDown size={18} aria-hidden="true" /><h2 className="text-base font-semibold">{title}</h2><span className="text-sm text-muted-foreground">({orders.length})</span></summary><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{orders.map(order => <article key={order.id} className="ui-card space-y-4">
            <div className="flex justify-between items-start gap-3"><div className="min-w-0"><Link className="text-sm text-primary font-semibold" href={`/orders/${order.id}`}><bdi>#{order.serialNumber}</bdi></Link><h3 className="font-semibold break-words mt-1">{order.customerName}</h3><p className="text-sm text-muted-foreground mt-1"><bdi>{order.customerPhone}</bdi></p></div><span className={`text-xs rounded-md px-2 py-1 shrink-0 ${order.status.includes('completed') ? 'bg-emerald-50 text-emerald-800' : 'bg-muted text-primary'}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span></div>
            {canViewFinancials && <dl className="grid grid-cols-2 gap-3 border-y border-border py-3"><div><dt className="text-xs text-muted-foreground">الإجمالي</dt><dd className="text-sm font-semibold mt-1"><bdi>{formatCurrency(order.totalAmount || 0)}</bdi></dd></div><div><dt className="text-xs text-muted-foreground">{CLOSED_ORDER_STATUSES.includes(order.status) ? 'مغلق — التسوية منفصلة' : 'المستحق'}</dt><dd className={`text-sm font-semibold mt-1 ${(order.remainingAmount || 0) > 0 ? 'text-red-700' : 'text-emerald-800'}`}><bdi>{CLOSED_ORDER_STATUSES.includes(order.status) ? '—' : formatCurrency(order.remainingAmount || 0)}</bdi></dd></div></dl>}
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar size={16} aria-hidden="true" />الاستحقاق: <bdi>{new Date(order.dueDate).toLocaleDateString('ar-LY')}</bdi>{Boolean(order.images?.length) && <span className="ms-auto text-xs">{order.images!.length} صور</span>}</p>
            <div className="flex justify-between gap-2"><Link className="ui-button" href={`/orders/${order.id}`}>تفاصيل الطلب</Link><div className="flex gap-2">{canViewFinancials && <Link href={`/orders/print/${order.id}`} target="_blank" className="ui-icon-button" aria-label={`طباعة الطلب ${order.serialNumber}`}><FileText size={18} aria-hidden="true" /></Link>}{can(PERMISSIONS.ORDERS_EDIT) && !CLOSED_ORDER_STATUSES.includes(order.status) && <Link href={`/orders/${order.id}/edit`} className="ui-icon-button" aria-label={`تعديل الطلب ${order.serialNumber}`}><Edit3 size={18} aria-hidden="true" /></Link>}</div></div>
        </article>)}</div></details>)}
        {(pages > 1 || result.nextCursor) && <nav aria-label="صفحات الطلبات" className="flex flex-wrap justify-center items-center gap-3"><button type="button" className="ui-button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>السابق</button><span className="text-sm" aria-live="polite">الصفحة {page} من {pages}</span><button type="button" className="ui-button" disabled={page === pages} onClick={() => setPage(value => value + 1)}>التالي</button>{result.nextCursor && <button type="button" className="ui-button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'جاري التحميل...' : 'تحميل المزيد'}</button>}</nav>}
    </section>;
}
