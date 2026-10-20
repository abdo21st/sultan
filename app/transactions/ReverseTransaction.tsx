'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function ReverseTransaction({ transaction, onSuccess }: {
    transaction: { id: string; type: string; amount: number; orderId?: string | null };
    onSuccess: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const key = useRef('');
    const titleId = useId();

    function show() { key.current = crypto.randomUUID(); setReason(''); setError(''); setOpen(true); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError('');
        try {
            const response = await fetch(`/api/transactions/${transaction.id}/reverse`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, idempotencyKey: key.current }),
            });
            const result = await response.json();
            if (!response.ok) {
                if (result.code === 'ALREADY_REVERSED') { setOpen(false); onSuccess(); return; }
                throw new Error(result.error || 'تعذر تسجيل التصحيح');
            }
            setOpen(false); onSuccess();
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر الاتصال؛ يمكنك إعادة المحاولة'); }
        finally { setBusy(false); }
    }

    return <>
        <button type="button" onClick={show} className="mt-2 text-xs text-primary underline inline-flex gap-1 items-center"><RotateCcw className="h-3 w-3" />عكس الحركة</button>
        {open && <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
            <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
                <h2 id={titleId} className="text-xl font-bold">تصحيح الحركة بقيد عكسي</h2>
                <p className="text-sm text-muted-foreground">ستبقى الحركة الأصلية، ويُسجّل تصحيح بقيمتها كاملة: {formatCurrency(transaction.amount)}.</p>
                <p className="text-sm">{transaction.orderId ? 'سينخفض صافي التحصيل ويزيد المبلغ المتبقي على الطلب بالقيمة نفسها. تبقى حالة التسليم كما هي، ويمكن تحصيل الرصيد المستحق لاحقاً.' : transaction.type === 'INCOME' ? 'سينخفض صافي الإيراد ورصيد الخزينة بالقيمة نفسها.' : 'سينخفض صافي المصروف ويزيد رصيد الخزينة بالقيمة نفسها.'}</p>
                <form onSubmit={submit} className="space-y-4">
                    <label className="block space-y-2 text-sm">
                        <span>سبب التصحيح</span>
                        <textarea required minLength={5} maxLength={500} disabled={busy} value={reason} onChange={event => { setReason(event.target.value); key.current = crypto.randomUUID(); }} className="w-full rounded-lg border border-border bg-background p-3" />
                    </label>
                    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3">
                        <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60">{busy ? 'جارٍ تسجيل التصحيح...' : 'تأكيد القيد العكسي'}</button>
                        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2">تراجع</button>
                    </div>
                </form>
            </section>
        </div>}
    </>;
}
