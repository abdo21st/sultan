'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, Settings, Trash2, ExternalLink } from 'lucide-react';
import { CORRECTION_ALERT_TRIGGER, ORDER_STATUS, ORDER_STATUS_LABELS, PRIMARY_ORDER_STATUSES } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import { usePermission } from '@/lib/usePermission';
import { businessDateKey, shiftDateKey } from '@/lib/business-date';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Rule { id: string; name: string; triggerStatus: string; timingDays: number; whatsappEnabled: boolean; recipientPhones: string[] }
interface Order { id: string; serialNumber: number; customerName: string; dueDate: string; status: string; remainingAmount?: number }
interface Account { id: string; displayName: string; phoneNumber?: string }
interface Health {
    stale: boolean;
    job: { lastSuccessAt: string | null; lastError: string | null } | null;
    whatsappConfigured: boolean;
    failures: { id: string; status: string; alertSetting: { name: string }; order: { id: string; serialNumber: number } }[];
}
const emptyRule = { name: '', triggerStatus: ORDER_STATUS.REGISTERED as string, timingDays: 0, whatsappEnabled: false, phones: '' };

export default function AlertsPage() {
    const { user, hasPermission } = usePermission();
    const canManage = hasPermission(PERMISSIONS.ALERTS_MANAGE) && (user?.role === 'ADMIN' || hasPermission(PERMISSIONS.FACILITIES_VIEW_ALL));
    const canViewFinancials = hasPermission(PERMISSIONS.ORDERS_VIEW_FINANCIALS);
    const [tab, setTab] = useState<'delivery' | 'receivables' | 'settings'>('delivery');
    const [orders, setOrders] = useState<Order[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [health, setHealth] = useState<Health | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [cursor, setCursor] = useState<string | null>(null);
    const [form, setForm] = useState(emptyRule);
    const [editingId, setEditingId] = useState<string | null>(null);
    const today = businessDateKey();

    const load = useCallback(async (next?: string) => {
        if (!user) return;
        setLoading(true);
        setError('');
        try {
            if (tab === 'settings') {
                if (!canManage) throw new Error('إدارة القواعد تحتاج صلاحية التنبيهات ومتابعة جميع المنشآت.');
                const [rulesRes, healthRes] = await Promise.all([fetch('/api/admin/alerts'), fetch('/api/admin/alerts/health')]);
                if (!rulesRes.ok || !healthRes.ok) throw new Error('تعذر تحميل إعدادات التنبيهات.');
                setRules(await rulesRes.json());
                setHealth(await healthRes.json());
            } else {
                const query = new URLSearchParams({ limit: '50' });
                if (tab === 'delivery') {
                    query.set('endDate', shiftDateKey(businessDateKey(), 1));
                    query.set('deliveryFollowUp', 'true');
                } else {
                    query.set('status', ORDER_STATUS.COMPLETED + ',COMPLETED');
                    query.set('paymentStatus', 'unpaid');
                }
                if (next) query.set('cursor', next);
                const response = await fetch('/api/orders?' + query, { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok || !Array.isArray(data)) throw new Error(data.error || 'تعذر تحميل الطلبات.');
                setOrders(current => next ? [...current, ...data] : data);
                setCursor(response.headers.get('X-Next-Cursor'));
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'تعذر الاتصال بالخادم.');
        } finally { setLoading(false); }
    }, [tab, canManage, user]);

    useEffect(() => { setOrders([]); setCursor(null); void load(); }, [load]);
    useEffect(() => {
        if (!canManage || !user?.permissions?.includes(PERMISSIONS.USERS_VIEW)) return;
        fetch('/api/users').then(async response => {
            if (response.ok) { const data = await response.json(); if (Array.isArray(data)) setAccounts(data); }
        }).catch(() => undefined);
    }, [canManage, user]);

    async function save(event: React.FormEvent) {
        event.preventDefault();
        setSaving(true);
        try {
            const response = await fetch(editingId ? '/api/admin/alerts/' + editingId : '/api/admin/alerts', {
                method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, recipientPhones: form.phones.split(/[\s,،;]+/).map(phone => phone.trim()).filter(Boolean) }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'تعذر حفظ التنبيه.');
            setForm(emptyRule); setEditingId(null); toast.success('تم حفظ التنبيه.'); await load();
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'تعذر الاتصال بالخادم.'); }
        finally { setSaving(false); }
    }
    async function remove(id: string) {
        if (!confirm('حذف قاعدة التنبيه؟')) return;
        setSaving(true);
        try {
            const response = await fetch('/api/admin/alerts/' + id, { method: 'DELETE' });
            if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'تعذر الحذف.'); }
            if (editingId === id) { setEditingId(null); setForm(emptyRule); }
            toast.success('تم حذف القاعدة.'); await load();
        } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'تعذر الاتصال بالخادم.'); }
        finally { setSaving(false); }
    }

    return <main className="ui-page max-w-6xl space-y-5 pb-16">
        <header className="ui-page-header">
            <div><h1 className="ui-page-title">متابعة الاستحقاقات</h1><p className="ui-page-description">التسليم المتأخر والقريب، والمبالغ المستحقة بعد التسليم.</p></div>
            <button className="ui-button" onClick={() => void load()} disabled={loading}>تحديث</button>
        </header>
        <div className="ui-tabs">
            <button className="ui-tab" aria-pressed={tab === 'delivery'} onClick={() => setTab('delivery')}>متابعة التسليم</button>
            {canViewFinancials && <button className="ui-tab" aria-pressed={tab === 'receivables'} onClick={() => setTab('receivables')}>مستحقات الطلبات المكتملة</button>}
            {canManage && <button className="ui-tab" aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>قواعد التنبيه</button>}
        </div>
        {error && <div className="ui-card text-destructive" role="alert">{error}</div>}
        {loading && <div className="flex justify-center p-6" role="status"><Loader2 className="animate-spin" /><span className="sr-only">جاري التحميل</span></div>}
        {tab !== 'settings' ? <>
            {!loading && !error && orders.length === 0 && <div className="ui-card text-center py-12"><Bell className="mx-auto mb-3 text-muted-foreground" />{tab === 'delivery' ? 'لا توجد طلبات متأخرة أو مستحقة اليوم أو غداً.' : 'لا توجد مبالغ متبقية على طلبات مكتملة.'}</div>}
            <div className="grid md:grid-cols-2 gap-4">{orders.map(order => {
                const dueDay = businessDateKey(new Date(order.dueDate));
                const label = tab === 'receivables' ? 'تم التسليم — يتبقى تحصيل' : dueDay < today ? 'متأخر عن التسليم' : dueDay === today ? 'التسليم اليوم' : 'التسليم غداً';
                return <article key={order.id} className="ui-card space-y-3">
                    <div className="flex justify-between gap-3"><h2 className="font-bold">#{order.serialNumber} · {order.customerName}</h2><span className={dueDay < today && tab === 'delivery' ? 'text-destructive text-sm' : 'text-primary text-sm'}>{label}</span></div>
                    <p className="text-sm text-muted-foreground">{ORDER_STATUS_LABELS[order.status] || order.status} · {new Date(order.dueDate).toLocaleDateString('ar-LY', { timeZone: 'Africa/Tripoli' })}</p>
                    {tab === 'receivables' && <p>المتبقي: {formatCurrency(order.remainingAmount ?? 0)}</p>}
                    <Link href={'/orders/' + order.id} className="ui-button inline-flex"><ExternalLink size={16} />فتح الطلب{tab === 'receivables' ? ' والتحصيل' : ''}</Link>
                </article>;
            })}</div>
            {cursor && <button className="ui-button mx-auto" disabled={loading} onClick={() => void load(cursor)}>تحميل المزيد</button>}
        </> : canManage && <>
            <section className="ui-card space-y-2" aria-label="حالة التنفيذ التلقائي">
                <h2 className="font-bold">حالة التنفيذ التلقائي</h2>
                <p className="text-sm">{health?.job?.lastSuccessAt ? 'آخر تشغيل ناجح: ' + new Date(health.job.lastSuccessAt).toLocaleString('ar-LY', { timeZone: 'Africa/Tripoli' }) : 'لم يُسجل تشغيل ناجح بعد.'}</p>
                {health?.job?.lastError && <p className="text-destructive" role="alert">تعذر التشغيل الأخير. راجع مسؤول النظام.</p>}
                {health?.stale && <p className="text-destructive" role="alert">لم يعمل مشغّل التنبيهات خلال آخر 15 دقيقة. راجع مسؤول النظام.</p>}
                <p className="text-sm text-muted-foreground">يفحص الخادم القواعد كل خمس دقائق بتوقيت ليبيا. يُرسل التنبيه الداخلي مرة واحدة لكل طلب وقاعدة ويوم، إلى الموظفين المسموح لهم بمتابعة الطلب.</p>
                <p className="text-sm">{health?.whatsappConfigured ? 'اتصال واتساب الآلي مضبوط.' : 'واتساب الآلي غير مفعّل أو غير مكتمل الإعداد؛ تعمل التنبيهات الداخلية.'}</p>
                {!!health?.failures.length && <div className="space-y-2"><p className="font-bold">إرسالات تحتاج متابعة</p>{health.failures.map(item => <p key={item.id} className="text-sm"><Link className="underline" href={'/orders/' + item.order.id}>طلب #{item.order.serialNumber}</Link> · {item.alertSetting.name} · {item.status === 'FAILED' ? 'رفض مزود الإرسال الطلب' : item.status === 'SENDING' ? 'جارٍ الإرسال أو بانتظار تأكيد النتيجة' : 'نتيجة الإرسال غير مؤكدة؛ تحقق قبل إعادة الإرسال'}</p>)}</div>}
            </section>
            <div className="grid lg:grid-cols-3 gap-5">
                <form onSubmit={save} className="ui-card space-y-4">
                    <h2 className="font-bold">{editingId ? 'تعديل القاعدة' : 'إضافة تنبيه آلي'}</h2>
                    <label className="block">اسم التنبيه<input className="ui-field mt-1" required minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
                    <label className="block">المرحلة أو علامة التصحيح<select className="ui-field mt-1" value={form.triggerStatus} onChange={event => setForm({ ...form, triggerStatus: event.target.value })}>{[...PRIMARY_ORDER_STATUSES, CORRECTION_ALERT_TRIGGER].map(status => <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>)}</select></label>
                    <label className="block">التوقيت بالنسبة لموعد التسليم<input className="ui-field mt-1" type="number" required min={-365} max={365} step={1} value={form.timingDays} onChange={event => setForm({ ...form, timingDays: Number(event.target.value) })} /></label>
                    <p className="text-xs text-muted-foreground">0 = يوم التسليم، -1 = قبله بيوم، 1 = بعده بيوم. تُطابق القاعدة حالة الطلب الحالية.</p>
                    <label className="flex gap-2 items-center"><input type="checkbox" checked={form.whatsappEnabled} onChange={event => setForm({ ...form, whatsappEnabled: event.target.checked })} />إرسال واتساب أيضاً</label>
                    {form.whatsappEnabled && <>
                        {accounts.length > 0 && <label className="block">إضافة رقم موظف<select className="ui-field mt-1" value="" onChange={event => { const account = accounts.find(item => item.id === event.target.value); if (account?.phoneNumber) setForm({ ...form, phones: [form.phones, account.phoneNumber].filter(Boolean).join(', ') }); }}><option value="">اختر موظفاً</option>{accounts.filter(account => account.phoneNumber).map(account => <option key={account.id} value={account.id}>{account.displayName}</option>)}</select></label>}
                        <label className="block">أرقام المستلمين<textarea className="ui-field mt-1" required dir="ltr" value={form.phones} placeholder="2189xxxxxxxx" onChange={event => setForm({ ...form, phones: event.target.value })} /></label>
                        <p className="text-xs text-muted-foreground">صيغة دولية، وافصل الأرقام بفاصلة أو سطر جديد. الإرسال إلى هذه الأرقام فقط.</p>
                    </>}
                    <div className="flex gap-2"><button className="ui-button ui-button-primary" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ القاعدة'}</button>{editingId && <button type="button" className="ui-button" onClick={() => { setEditingId(null); setForm(emptyRule); }}>إلغاء التعديل</button>}</div>
                </form>
                <div className="lg:col-span-2 space-y-3">{rules.map(rule => <article key={rule.id} className="ui-card flex justify-between gap-3">
                    <div><h3 className="font-bold">{rule.name}</h3><p className="text-sm text-muted-foreground">{ORDER_STATUS_LABELS[rule.triggerStatus]} · {rule.timingDays === 0 ? 'يوم التسليم' : Math.abs(rule.timingDays) + ' يوم ' + (rule.timingDays < 0 ? 'قبل التسليم' : 'بعد التسليم')}</p><p className="text-xs mt-1">تنبيه داخلي{rule.whatsappEnabled ? ' + واتساب إلى ' + rule.recipientPhones.length + ' رقم' : ''}</p></div>
                    <div className="flex gap-2"><button className="ui-button" aria-label={'تعديل ' + rule.name} onClick={() => { setEditingId(rule.id); setForm({ ...rule, phones: rule.recipientPhones.join(', ') }); }}><Settings size={16} /></button><button className="ui-button text-destructive" disabled={saving} aria-label={'حذف ' + rule.name} onClick={() => void remove(rule.id)}><Trash2 size={16} /></button></div>
                </article>)}{!loading && rules.length === 0 && <p className="ui-card">لم تُضف قواعد تنبيه بعد.</p>}</div>
            </div>
        </>}
    </main>;
}
