'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CLOSED_ORDER_STATUSES, ORDER_STATUS, normalizeOrderStatus } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { useToast } from '@/app/components/ToastProvider';
import Modal from '@/app/components/Modal';
import { formatCurrency } from '@/lib/utils';

interface Order {
    id: string; status: string; remainingAmount: number; reviewRequired: boolean; rejectionReason: string | null;
}
interface User { role: string; permissions?: string[] }
export default function OrderActions({ order, currentUser }: { order: Order; currentUser?: User | null }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [busy, setBusy] = useState(false);
    const [correctionOpen, setCorrectionOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [deliveryOpen, setDeliveryOpen] = useState(false);
    const [payment, setPayment] = useState('0');
    const [note, setNote] = useState('');
    const can = (permission: string) => currentUser?.role === 'ADMIN' || Boolean(currentUser?.permissions?.includes(permission));
    const financial = can(PERMISSIONS.ORDERS_VIEW_FINANCIALS);
    const canCollect = financial && can(PERMISSIONS.TRANSACTIONS_ADD);
    const phase = normalizeOrderStatus(order.status);
    const closed = CLOSED_ORDER_STATUSES.includes(phase) || phase === ORDER_STATUS.COMPLETED;

    async function change(status: string, correctionReason?: string) {
        if (busy) return;
        setBusy(true);
        try {
            const response = await fetch('/api/orders/' + order.id + '/workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(status === ORDER_STATUS.REVIEW ? { action: 'request_correction', reason: correctionReason } : { action: 'change_stage', status }) });
            const result = await response.json();
            if (!response.ok || !result.success) { showToast(result.error || 'تعذر حفظ الإجراء', 'error'); return; }
            setCorrectionOpen(false); setReason('');
            showToast(status === ORDER_STATUS.REVIEW ? 'أُرسلت ملاحظة التصحيح للمحل، وبقيت مرحلة الطلب كما هي.' : 'تم تحديث مرحلة الطلب وإشعار الجهة المعنية.', 'success');
            router.refresh();
        } catch { showToast('تعذر الاتصال بالخادم.', 'error'); }
        finally { setBusy(false); }
    }
    async function deliver() {
        if (busy) return;
        setBusy(true);
        try {
            const response = await fetch('/api/orders/' + order.id + '/workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'deliver', paymentAmount: canCollect ? Number(payment || 0) : 0, paymentNote: note }) });
            const result = await response.json();
            if (!response.ok || !result.success) { showToast(result.error || 'تعذر تأكيد التسليم', 'error'); return; }
            setDeliveryOpen(false); setPayment('0'); setNote('');
            showToast('تم تأكيد تسليم الطلب للعميل. تُتابع المبالغ المتبقية بشكل مستقل.', 'success');
            router.refresh();
        } catch { showToast('تعذر الاتصال بالخادم.', 'error'); }
        finally { setBusy(false); }
    }

    return <section className="ui-card space-y-4" aria-label="إجراءات الطلب">
        <h2 className="font-bold">إجراءات الطلب</h2>
        <div className="flex flex-col gap-3">
            {financial && can(PERMISSIONS.ORDERS_SHARE) && <Link className="ui-button" href={'/orders/print/' + order.id} target="_blank">طباعة أو تنزيل مستند الطلب</Link>}
            {order.reviewRequired && !closed ? <>
                <p className="text-sm text-primary">يحتاج الطلب تصحيحاً قبل متابعة التجهيز أو التسليم.</p>
                {can(PERMISSIONS.ORDERS_EDIT) && <Link className="ui-button ui-button-primary" href={'/orders/' + order.id + '/edit'}>تصحيح بيانات الطلب</Link>}
            </> : !closed && <>
                {phase === ORDER_STATUS.REGISTERED && can(PERMISSIONS.STATUS_CHANGE_PROCESSING) && <button className="ui-button ui-button-primary" disabled={busy} onClick={() => void change(ORDER_STATUS.PROCESSING)}>بدء تجهيز الطلب في المصنع</button>}
                {phase === ORDER_STATUS.PROCESSING && can(PERMISSIONS.STATUS_CHANGE_SHOP_READY) && <button className="ui-button ui-button-primary" disabled={busy} onClick={() => void change(ORDER_STATUS.SHOP_READY)}>إنهاء التجهيز وإشعار المحل</button>}
                {phase === ORDER_STATUS.SHOP_READY && can(PERMISSIONS.STATUS_CHANGE_COMPLETED) && <button className="ui-button ui-button-primary" disabled={busy} onClick={() => { setPayment('0'); setDeliveryOpen(true); }}>تأكيد تسليم الطلب للعميل</button>}
                {can(PERMISSIONS.STATUS_CHANGE_REVIEW) && <button className="ui-button" disabled={busy} onClick={() => setCorrectionOpen(true)}>طلب تصحيح البيانات مع السبب</button>}
            </>}
        </div>
        {correctionOpen && <Modal isOpen onClose={() => { if (!busy) setCorrectionOpen(false); }} title="الطلب يحتاج تصحيحاً">
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); void change(ORDER_STATUS.REVIEW, reason); }}>
                <p className="text-sm text-muted-foreground">تبقى مرحلة الطلب الحالية، وتتوقف إجراءات التجهيز والتسليم حتى يصحح المحل البيانات.</p>
                <label className="block">سبب التصحيح<textarea required minLength={5} maxLength={1000} className="ui-field mt-2 min-h-32" disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>
                <div className="flex gap-2"><button className="ui-button ui-button-primary" disabled={busy}>{busy ? 'جارٍ الحفظ...' : 'إرسال ملاحظة التصحيح'}</button><button className="ui-button" type="button" disabled={busy} onClick={() => setCorrectionOpen(false)}>تراجع</button></div>
            </form>
        </Modal>}
        {deliveryOpen && <Modal isOpen onClose={() => { if (!busy) setDeliveryOpen(false); }} title="تأكيد تسليم الطلب للعميل">
            <form className="space-y-4" onSubmit={event => { event.preventDefault(); void deliver(); }}>
                <p className="text-sm">أكد هذه الخطوة بعد تسليم الطلب فعلياً للعميل. يمكن تأكيد التسليم دون تحصيل، وتبقى المبالغ المستحقة للمتابعة لاحقاً.</p>
                {financial && <p className="rounded-lg bg-muted p-3">المبلغ المتبقي قبل التسليم: {formatCurrency(order.remainingAmount)}</p>}
                {canCollect && <label className="block">تحصيل عند التسليم — اختياري<input type="number" className="ui-field mt-2" min="0" max={order.remainingAmount} step="0.01" required disabled={busy} value={payment} onChange={event => setPayment(event.target.value)} /><span className="block text-xs text-muted-foreground mt-1">اتركه صفراً إن لم يُحصَّل مبلغ الآن.</span></label>}
                <label className="block">ملاحظات التسليم<textarea maxLength={2000} className="ui-field mt-2" disabled={busy} value={note} onChange={event => setNote(event.target.value)} /></label>
                <div className="flex gap-2"><button className="ui-button ui-button-primary" disabled={busy}>{busy ? 'جارٍ التأكيد...' : 'تأكيد التسليم للعميل'}</button><button type="button" className="ui-button" disabled={busy} onClick={() => setDeliveryOpen(false)}>تراجع</button></div>
            </form>
        </Modal>}
    </section>;
}
