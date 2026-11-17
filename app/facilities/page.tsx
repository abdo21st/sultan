'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';
import { useToast } from '../components/ToastProvider';

interface Facility { id: string; name: string; type: string; location: string; preparationMinutes: number; }
export default function FacilitiesPage() {
    const { hasPermission, user } = usePermission();
    const { showToast } = useToast();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const [preparationDraft, setPreparationDraft] = useState<Record<string, string>>({});
    const [savingPreparation, setSavingPreparation] = useState<string | null>(null);
    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            const response = await fetch('/api/facilities', { signal });
            if (!response.ok) throw new Error('تعذر تحميل المنشآت. تحقق من الاتصال وصلاحية الدخول.');
            const data: unknown = await response.json();
            if (!Array.isArray(data)) throw new Error('تعذر قراءة المنشآت.');
            if (!signal?.aborted) { setFacilities(data); setError(''); }
        } catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المنشآت.'); }
        finally { if (!signal?.aborted) setLoading(false); }
    }, []);
    useEffect(() => {
        const abort = new AbortController();
        const task = window.setTimeout(() => { void load(abort.signal); }, 0);
        return () => { window.clearTimeout(task); abort.abort(); };
    }, [load]);
    const remove = async (facility: Facility) => {
        if (!confirm(`هل تريد حذف المنشأة «${facility.name}»؟`)) return;
        setDeleting(facility.id);
        try {
            const response = await fetch(`/api/facilities/${facility.id}`, { method: 'DELETE' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'تعذر حذف المنشأة.');
            showToast('تم حذف المنشأة', 'success'); await load();
        } catch (reason) { showToast(reason instanceof Error ? reason.message : 'تعذر حذف المنشأة.', 'error'); }
        finally { setDeleting(null); }
    };
    const savePreparation = async (facility: Facility) => {
        const value = Number(preparationDraft[facility.id] ?? facility.preparationMinutes);
        setSavingPreparation(facility.id);
        try {
            const response = await fetch(`/api/facilities/${facility.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preparationMinutes: value }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'تعذر حفظ مدة التجهيز.');
            showToast('تم تحديث مدة تجهيز المصنع', 'success'); await load();
        } catch (reason) { showToast(reason instanceof Error ? reason.message : 'تعذر حفظ مدة التجهيز.', 'error'); }
        finally { setSavingPreparation(null); }
    };
    return <main className="ui-page space-y-5">
        <header className="ui-page-header"><div><h1 className="ui-page-title">المنشآت</h1><p className="ui-page-description">المحلات والمصانع المرتبطة بالطلبات.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="ui-button" onClick={() => { setLoading(true); setError(''); void load(); }} disabled={loading}><RefreshCw size={17} aria-hidden="true" />تحديث</button>{hasPermission(PERMISSIONS.FACILITIES_ADD) && <Link href="/facilities/new" className="ui-button ui-button-primary"><Plus size={18} aria-hidden="true" />منشأة جديدة</Link>}</div></header>
        {error && <p className="ui-card text-red-700" role="alert">{error}</p>}
        {loading ? <p role="status" className="ui-card text-muted-foreground">جاري تحميل المنشآت...</p> : !facilities.length && !error ? <div className="ui-card text-center py-10"><Building2 size={32} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" /><h2 className="text-lg font-semibold">لا توجد منشآت بعد</h2><p className="text-sm text-muted-foreground mt-2">أضف المحلات والمصانع التي تعمل معها.</p></div> : <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{facilities.map(facility => {
            const canManagePreparation = facility.type === 'FACTORY' && hasPermission(PERMISSIONS.FACTORY_PREPARATION_MANAGE) && (user?.role === 'ADMIN' || user?.facilityId === facility.id);
            return <li key={facility.id} className="ui-card flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="font-semibold break-words">{facility.name}</h2><p className="text-sm text-muted-foreground mt-2">{facility.type === 'FACTORY' ? 'مصنع' : 'محل'}</p><p className="text-sm mt-1 break-words">{facility.location}</p>
                {facility.type === 'FACTORY' && (canManagePreparation ? <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void savePreparation(facility); }}><label className="text-sm"><span className="block text-xs text-muted-foreground mb-1">مدة تجهيز الطلب (دقيقة)</span><input type="number" min="5" max="1440" required className="ui-field w-32" value={preparationDraft[facility.id] ?? String(facility.preparationMinutes ?? 60)} onChange={event => setPreparationDraft(current => ({ ...current, [facility.id]: event.target.value }))} /></label><button type="submit" className="ui-button ui-button-primary" disabled={savingPreparation === facility.id}>{savingPreparation === facility.id ? 'جارٍ الحفظ…' : 'حفظ المدة'}</button></form> : <p className="text-sm mt-3">مدة التجهيز الافتراضية: {facility.preparationMinutes ?? 60} دقيقة</p>)}
            </div><div className="flex items-center gap-1">{hasPermission(PERMISSIONS.FACILITIES_DELETE) && <button type="button" className="ui-icon-button" aria-label={`حذف ${facility.name}`} disabled={Boolean(deleting)} onClick={() => void remove(facility)}><Trash2 size={18} className="text-red-700" aria-hidden="true" /></button>}</div></li>;
        })}</ul>}
    </main>;
}
