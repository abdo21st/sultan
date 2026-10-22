'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';
import { useToast } from '../components/ToastProvider';

interface Facility { id: string; name: string; type: string; location: string; }
export default function FacilitiesPage() {
    const { hasPermission } = usePermission();
    const { showToast } = useToast();
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true); setError('');
        try {
            const response = await fetch('/api/facilities', { signal });
            if (!response.ok) throw new Error('تعذر تحميل المنشآت. تحقق من الاتصال وصلاحية الدخول.');
            const data: unknown = await response.json();
            if (!Array.isArray(data)) throw new Error('تعذر قراءة المنشآت.');
            if (!signal?.aborted) setFacilities(data);
        } catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المنشآت.'); }
        finally { if (!signal?.aborted) setLoading(false); }
    }, []);
    useEffect(() => { const abort = new AbortController(); void load(abort.signal); return () => abort.abort(); }, [load]);
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
    return <main className="ui-page space-y-5">
        <header className="ui-page-header"><div><h1 className="ui-page-title">المنشآت</h1><p className="ui-page-description">المحلات والمصانع المرتبطة بالطلبات.</p></div><div className="flex flex-wrap gap-2"><button type="button" className="ui-button" onClick={() => void load()} disabled={loading}><RefreshCw size={17} aria-hidden="true" />تحديث</button>{hasPermission(PERMISSIONS.FACILITIES_ADD) && <Link href="/facilities/new" className="ui-button ui-button-primary"><Plus size={18} aria-hidden="true" />منشأة جديدة</Link>}</div></header>
        {error && <p className="ui-card text-red-700" role="alert">{error}</p>}
        {loading ? <p role="status" className="ui-card text-muted-foreground">جاري تحميل المنشآت...</p> : !facilities.length && !error ? <div className="ui-card text-center py-10"><Building2 size={32} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" /><h2 className="text-lg font-semibold">لا توجد منشآت بعد</h2><p className="text-sm text-muted-foreground mt-2">أضف المحلات والمصانع التي تعمل معها.</p></div> : <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{facilities.map(facility => <li key={facility.id} className="ui-card flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold break-words">{facility.name}</h2><p className="text-sm text-muted-foreground mt-2">{facility.type === 'FACTORY' ? 'مصنع' : 'محل'}</p><p className="text-sm mt-1 break-words">{facility.location}</p></div>{hasPermission(PERMISSIONS.FACILITIES_DELETE) && <button type="button" className="ui-icon-button" aria-label={`حذف ${facility.name}`} disabled={Boolean(deleting)} onClick={() => void remove(facility)}><Trash2 size={18} className="text-red-700" aria-hidden="true" /></button>}</li>)}</ul>}
    </main>;
}
