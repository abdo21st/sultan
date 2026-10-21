'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CLOSED_ORDER_STATUSES, ORDER_STATUS } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { formatCurrency } from '@/lib/utils';

export interface AdjustmentItem {
    id: string; kind: string; status: string; reason: string; reviewNote: string | null;
    requestedAt: string; refundAmount?: number; refundedAmount?: number; refundRemaining?: number;
}

export default function OrderAdjustments({ orderId, orderStatus, permissions, items }: {
    orderId: string; orderStatus: string; permissions: string[]; items: AdjustmentItem[];
}) {
    const router = useRouter();
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const key = useRef('');
    const lock = useRef(false);
    const active = items.find(item => item.status === 'REQUESTED' || item.status === 'APPROVED');
    const canRequest = permissions.includes(PERMISSIONS.ORDERS_ADJUSTMENT_REQUEST);
    const canReview = permissions.includes(PERMISSIONS.ORDERS_ADJUSTMENT_APPROVE) && permissions.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS);
    const canRefund = [PERMISSIONS.ORDERS_REFUND, PERMISSIONS.TRANSACTIONS_ADD, PERMISSIONS.ORDERS_VIEW_FINANCIALS].every(permission => permissions.includes(permission));
    const kind = [ORDER_STATUS.COMPLETED, 'COMPLETED'].includes(orderStatus) ? 'RETURN' : 'CANCEL';
    const label = kind === 'RETURN' ? 'مرتجع' : 'إلغاء';

    async function submit(path: string, payload: Record<string, unknown>, message: string) {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError(''); setSuccess('');
        if (!key.current) key.current = crypto.randomUUID();
        try {
            const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, ...(payload.kind ? { requestKey: key.current } : payload.amount ? { idempotencyKey: key.current } : {}) }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'تعذر إتمام العملية.');
            key.current = ''; setReason(''); setNote(''); setAmount(''); setSuccess(message); router.refresh();
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر الاتصال. يمكنك إعادة المحاولة.'); }
        finally { lock.current = false; setBusy(false); }
    }

    if (!canRequest && !canReview && !canRefund && !items.length) return null;
    return <section className="ui-card space-y-4" aria-label="الإلغاء والمرتجعات">
        <h2 className="font-bold text-lg">الإلغاء والمرتجعات</h2>
        {items.map(item => <article key={item.id} className="rounded-lg border border-border p-4 space-y-2">
            <p className="font-bold">{item.kind === 'RETURN' ? 'مرتجع' : 'إلغاء'} · {({ REQUESTED: 'بانتظار موافقة المدير', APPROVED: 'معتمد', REJECTED: 'مرفوض' } as Record<string, string>)[item.status]}</p>
            <p className="text-sm whitespace-pre-wrap">السبب: {item.reason}</p>
            <p className="text-xs text-muted-foreground">{new Date(item.requestedAt).toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli' })}</p>
            {item.reviewNote && <p className="text-sm whitespace-pre-wrap">ملاحظة المدير: {item.reviewNote}</p>}
            {item.status === 'APPROVED' && <>
                <p className="text-sm">أُغلق الطلب. حُفظت قيمته ودفعاته الأصلية للتدقيق، وأُوقف تحصيل الرصيد الأصلي. رد المبلغ يُسجل منفصلاً بعد إعادته فعلياً.</p>
                {item.refundAmount !== undefined && <p className="text-sm">المعتمد للرد: {formatCurrency(item.refundAmount)} · المُعاد فعلياً: {formatCurrency(item.refundedAmount ?? 0)} · المتبقي للعميل: {formatCurrency(item.refundRemaining ?? 0)}</p>}
            </>}
        </article>)}
        {active?.status === 'REQUESTED' && <p className="text-sm text-primary">توقفت إجراءات التجهيز والتسليم والتحصيل والتعديل حتى قرار المدير.</p>}
        {!active && !CLOSED_ORDER_STATUSES.includes(orderStatus) && canRequest && <form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit('/api/orders/' + orderId + '/adjustments', { kind, reason }, 'أُرسل الطلب إلى المدير للمراجعة.'); }}>
            <label className="block">سبب طلب {label}<textarea className="ui-field mt-1" required minLength={5} maxLength={1000} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); key.current = ''; }} /></label>
            <button className="ui-button" disabled={busy}>إرسال طلب {label} للمدير</button>
        </form>}
        {active?.status === 'REQUESTED' && canReview && <form className="space-y-3" onSubmit={(event: FormEvent) => event.preventDefault()}>
            <label className="block">ملاحظة قرار المدير<textarea className="ui-field mt-1" required minLength={5} maxLength={1000} disabled={busy} value={note} onChange={event => setNote(event.target.value)} /></label>
            <p className="text-sm text-muted-foreground">الموافقة تُغلق الطلب وتُنشئ استحقاق رد جميع المبالغ المحصلة. لا تُسجل حركة رد نقدي تلقائياً.</p>
            <div className="flex flex-wrap gap-2"><button type="button" className="ui-button ui-button-primary" disabled={busy || note.trim().length < 5} onClick={() => void submit('/api/order-adjustments/' + active.id + '/review', { decision: 'APPROVED', note }, 'تمت الموافقة؛ يمكنك تسجيل التسوية المالية منفصلة.')}>اعتماد {active.kind === 'RETURN' ? 'المرتجع' : 'الإلغاء'}</button><button type="button" className="ui-button" disabled={busy || note.trim().length < 5} onClick={() => void submit('/api/order-adjustments/' + active.id + '/review', { decision: 'REJECTED', note }, 'رُفض الطلب وأُعيد فتح إجراءات العمل.')}>رفض الطلب</button></div>
        </form>}
        {active?.status === 'APPROVED' && (active.refundRemaining ?? 0) > 0 && canRefund && <form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void submit('/api/order-adjustments/' + active.id + '/refund', { amount: Number(amount), note }, 'تم تسجيل رد المبلغ في الحركات المالية.'); }}>
            <h3 className="font-bold">تسجيل مبلغ أُعيد للعميل</h3>
            <label className="block">المبلغ المُعاد فعلياً<input className="ui-field mt-1" type="number" min="0.01" step="0.01" max={active.refundRemaining} required disabled={busy} value={amount} onChange={event => { setAmount(event.target.value); key.current = ''; }} /></label>
            <label className="block">بيان التسوية أو مرجع الاستلام<textarea className="ui-field mt-1" required minLength={5} maxLength={500} disabled={busy} value={note} onChange={event => { setNote(event.target.value); key.current = ''; }} /></label>
            <p className="text-xs text-muted-foreground">تأكيد التسجيل يثبت رد المبلغ في الخزينة؛ لا ينفّذ تحويلاً بنكياً.</p>
            <button className="ui-button ui-button-primary" disabled={busy}>تأكيد تسجيل رد المبلغ</button>
        </form>}
        {busy && <p role="status">جارٍ الحفظ...</p>}{error && <p role="alert" className="text-destructive">{error}</p>}{success && <p role="status" className="text-green-700">{success}</p>}
    </section>;
}
