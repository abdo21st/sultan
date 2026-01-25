'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditOrderPage() {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<{
        customerName: string;
        customerPhone: string;
        status: string;
        totalAmount: string;
        paidAmount: string;
        dueDate: string;
    } | null>(null);

    useEffect(() => {
        if (!params?.id) return;

        const id = Array.isArray(params.id) ? params.id[0] : params.id;

        fetch(`/api/orders/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Order not found');
                return res.json();
            })
            .then(data => {
                // Format date for input
                if (data.dueDate) {
                    data.dueDate = new Date(data.dueDate).toISOString().split('T')[0];
                }
                setFormData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                setError('فشل تحميل الطلب');
                setLoading(false);
            });
    }, [params]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const id = Array.isArray(params.id) ? params.id[0] : params.id;
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error('Update failed');

            router.push('/');
            router.refresh();
        } catch {
            setError('فشل تحديث الطلب');
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;
    if (!formData) return <div className="p-8 text-center text-red-500">الطلب غير موجود</div>;

    return (
        <div className="min-h-screen bg-background p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl bg-card border border-border rounded-xl p-8 shadow-sm">
                <h1 className="text-2xl font-bold mb-6 text-foreground">تعديل الطلب #{String(params.id).slice(-6)}</h1>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">اسم العميل</label>
                            <input
                                required
                                type="text"
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                aria-label="اسم العميل"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">رقم الهاتف</label>
                            <input
                                required
                                type="tel"
                                dir="ltr"
                                value={formData.customerPhone}
                                onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                aria-label="رقم الهاتف"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">حالة الطلب</label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            aria-label="حالة الطلب"
                        >
                            <option value="REGISTERED">مسجل (REGISTERED)</option>
                            <option value="PROCESSING">قيد التنفيذ (PROCESSING)</option>
                            <option value="COMPLETED">مكتمل (COMPLETED)</option>
                            <option value="CANCELLED">ملغي (CANCELLED)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">الإجمالي</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                dir="ltr"
                                value={formData.totalAmount}
                                onChange={e => setFormData({ ...formData, totalAmount: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                aria-label="الإجمالي"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">المدفوع</label>
                            <input
                                type="number"
                                step="0.01"
                                dir="ltr"
                                value={formData.paidAmount}
                                onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                aria-label="المدفوع"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">تاريخ الاستحقاق</label>
                            <input
                                required
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                aria-label="تاريخ الاستحقاق"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-amber-600 rounded-lg shadow-lg disabled:opacity-50"
                        >
                            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
