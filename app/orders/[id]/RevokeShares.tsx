'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';

export default function RevokeShares({ orderId, canIssue, canRevoke }: { orderId: string; canIssue: boolean; canRevoke: boolean }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [link, setLink] = useState('');

    async function issue() {
        setBusy(true);
        try {
            const response = await fetch(`/api/orders/${orderId}/shares`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'تعذر إنشاء الرابط');
            const url = new URL(result.path, window.location.origin).toString();
            setLink(url);
            try { await navigator.clipboard.writeText(url); toast.success('نُسخ رابط صالح لمدة سبعة أيام'); }
            catch { toast.success('الرابط جاهز للنسخ'); }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم');
        } finally { setBusy(false); }
    }

    async function revoke(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        try {
            const response = await fetch(`/api/orders/${orderId}/shares`, {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'تعذر إلغاء الروابط');
            toast.success('أُلغيت روابط المشاركة السابقة. يمكنك إصدار رابط جديد من صفحة الطباعة.');
            setOpen(false);
            setReason('');
            setLink('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'تعذر الاتصال بالخادم');
        } finally { setBusy(false); }
    }

    return (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-bold">روابط مشاركة الطلب</h3>
            <p className="text-sm text-muted-foreground">يتيح الرابط لمن يملكه الاطلاع على بيانات العميل والمبالغ وصور الطلب لمدة سبعة أيام.</p>
            {canIssue && <button disabled={busy} type="button" onClick={issue} className="text-sm font-bold text-primary underline disabled:opacity-60">إنشاء رابط مشاركة ونسخه</button>}
            {link && <input aria-label="رابط مشاركة الطلب" readOnly value={link} onFocus={event => event.target.select()} dir="ltr" className="w-full rounded-lg border border-border bg-background p-2 text-xs" />}
            <p className="text-sm text-muted-foreground">الإلغاء يوقف جميع الروابط ورموز QR السابقة لهذا الطلب. تبقى النسخ التي نُزّلت أو طُبعت لدى مستلميها.</p>
            {canRevoke && (!open ? <button className="text-sm font-bold text-red-600 underline" onClick={() => setOpen(true)}>إلغاء روابط المشاركة الحالية</button> : (
                <form onSubmit={revoke} className="space-y-3">
                    <label className="block text-sm space-y-2">
                        <span>سبب إلغاء الروابط</span>
                        <input required minLength={5} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3" />
                    </label>
                    <div className="flex gap-4">
                        <button disabled={busy} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-60">تأكيد إلغاء الروابط</button>
                        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-sm">تراجع</button>
                    </div>
                </form>
            ))}
        </section>
    );
}
