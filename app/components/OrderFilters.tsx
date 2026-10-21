'use client';

import { useEffect, useState } from 'react';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from '@/lib/constants';
import Modal from './Modal';

export interface FilterState { customerName: string; status: string[]; startDate: string; endDate: string; paymentStatus: string; factoryId: string; }
const emptyFilters: FilterState = { customerName: '', status: [], startDate: '', endDate: '', paymentStatus: '', factoryId: '' };
export default function OrderFilters({ isOpen, onClose, onApply, initialFilters }: { isOpen: boolean; onClose: () => void; onApply: (filters: FilterState) => void; initialFilters: Partial<FilterState> }) {
    const [filters, setFilters] = useState<FilterState>({ ...emptyFilters, ...initialFilters });
    const [facilities, setFacilities] = useState<{ id: string; name: string; type: string }[]>([]);
    useEffect(() => {
        const abort = new AbortController();
        fetch('/api/facilities', { signal: abort.signal }).then(res => res.ok ? res.json() : []).then(data => { if (!abort.signal.aborted && Array.isArray(data)) setFacilities(data.filter(f => f.type === 'FACTORY')); }).catch(() => {});
        return () => abort.abort();
    }, []);
    return <Modal isOpen={isOpen} onClose={onClose} title="تصفية متقدمة">
        <form className="space-y-5" onSubmit={event => { event.preventDefault(); onApply(filters); onClose(); }}>
            <label className="block"><span className="ui-field-label">اسم العميل</span><input className="ui-field" value={filters.customerName} onChange={event => setFilters(previous => ({ ...previous, customerName: event.target.value }))} /></label>
            <fieldset><legend className="ui-field-label">حالات الطلب</legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{Object.entries(ORDER_STATUS_LABELS).filter(([key]) => (Object.values(ORDER_STATUS) as readonly string[]).includes(key)).map(([value, label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 min-h-11 text-sm"><input type="checkbox" checked={filters.status.includes(value)} onChange={event => setFilters(previous => ({ ...previous, status: event.target.checked ? [...previous.status, value] : previous.status.filter(status => status !== value) }))} />{label}</label>)}</div></fieldset>
            <label className="block"><span className="ui-field-label">المصنع المنفذ</span><select className="ui-field" value={filters.factoryId} onChange={event => setFilters(previous => ({ ...previous, factoryId: event.target.value }))}><option value="">جميع المصانع</option>{facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</select></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label><span className="ui-field-label">الاستحقاق من</span><input type="date" className="ui-field" value={filters.startDate} onChange={event => setFilters(previous => ({ ...previous, startDate: event.target.value }))} /></label><label><span className="ui-field-label">الاستحقاق إلى</span><input type="date" className="ui-field" min={filters.startDate || undefined} value={filters.endDate} onChange={event => setFilters(previous => ({ ...previous, endDate: event.target.value }))} /></label></div>
            <label className="flex items-center gap-2 text-sm min-h-11"><input type="checkbox" checked={filters.paymentStatus === 'unpaid'} onChange={event => setFilters(previous => ({ ...previous, paymentStatus: event.target.checked ? 'unpaid' : '' }))} />طلبات لها رصيد مستحق فقط</label>
            <div className="flex justify-end flex-wrap gap-2 border-t border-border pt-4"><button type="button" className="ui-button" onClick={() => setFilters({ ...emptyFilters })}>إعادة تعيين</button><button type="submit" className="ui-button ui-button-primary">تطبيق التصفية</button></div>
        </form>
    </Modal>;
}
