'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import type { AdjustmentItem } from '@/app/orders/[id]/OrderAdjustments';

type Item = AdjustmentItem & { order: { id: string; serialNumber: number; customerName: string } };
export default function AdjustmentsPage() {
    const [status, setStatus] = useState('REQUESTED');
    const [items, setItems] = useState<Item[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async (next?: string) => {
        setLoading(true); setError('');
        try {
            const query = new URLSearchParams({ status, limit: '50', ...(next ? { cursor: next } : {}) });
            const response = await fetch('/api/order-adjustments?' + query, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'تعذر تحميل الطلبات.');
            setItems(current => next ? [...current, ...data.items] : data.items); setCursor(data.nextCursor);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر الاتصال.'); }
        finally { setLoading(false); }
    }, [status]);
    useEffect(() => { setItems([]); void load(); }, [load]);
    return <main className="ui-page space-y-5">
        <header className="ui-page-header"><div><h1 className="ui-page-title">الإلغاء والمرتجعات</h1><p className="ui-page-description">طلبات الموظفين، قرار المدير، ثم تسجيل المبالغ المُعادة بشكل منفصل.</p></div><button className="ui-button" disabled={loading} onClick={() => void load()}>تحديث</button></header>
        <div className="ui-tabs">{[{ value: 'REQUESTED', label: 'بانتظار المراجعة' }, { value: 'APPROVED', label: 'المعتمدة والتسويات' }, { value: 'REJECTED', label: 'المرفوضة' }].map(tab => <button key={tab.value} className="ui-tab" aria-pressed={status === tab.value} onClick={() => setStatus(tab.value)}>{tab.label}</button>)}</div>
        {error && <p className="ui-card text-destructive" role="alert">{error}</p>}{loading && <p role="status">جارٍ التحميل...</p>}
        {!loading && !error && !items.length && <p className="ui-card">لا توجد طلبات في هذا القسم.</p>}
        <div className="grid md:grid-cols-2 gap-4">{items.map(item => <article key={item.id} className="ui-card space-y-3"><h2 className="font-bold">طلب #{item.order.serialNumber} · {item.order.customerName}</h2><p>{item.kind === 'RETURN' ? 'مرتجع' : 'إلغاء'} · {item.reason}</p>{item.status === 'APPROVED' && item.refundRemaining !== undefined && <p>المتبقي للرد: {formatCurrency(item.refundRemaining)}</p>}<Link className="ui-button inline-flex" href={'/orders/' + item.order.id}>{item.status === 'REQUESTED' ? 'فتح الطلب والمراجعة' : 'فتح تفاصيل الطلب والتسوية'}</Link></article>)}</div>
        {cursor && <button className="ui-button" disabled={loading} onClick={() => void load(cursor)}>تحميل المزيد</button>}
    </main>;
}
