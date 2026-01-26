'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Facility {
    id: string;
    name: string;
    type: string;
}

interface OrderFormData {
    customerName: string;
    customerPhone: string;
    description: string;
    status: string;
    totalAmount: string;
    paidAmount: string;
    dueDate: string;
    factoryId: string;
    shopId: string;
    images?: string[];
}

export default function EditOrderPage() {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [formData, setFormData] = useState<OrderFormData | null>(null);

    useEffect(() => {
        if (!params?.id) return;

        const id = Array.isArray(params.id) ? params.id[0] : params.id;

        // Fetch facilities and order data
        Promise.all([
            fetch('/api/facilities').then(res => res.json()),
            fetch(`/api/orders/${id}`).then(res => {
                if (!res.ok) throw new Error('Order not found');
                return res.json();
            })
        ])
            .then(([facilitiesData, orderData]) => {
                setFacilities(facilitiesData);

                // Format order data for form
                const formattedData: OrderFormData = {
                    ...orderData,
                    totalAmount: String(orderData.totalAmount),
                    paidAmount: String(orderData.paidAmount),
                    dueDate: orderData.dueDate ? new Date(orderData.dueDate).toISOString().split('T')[0] : '',
                };
                setFormData(formattedData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                setError('فشل تحميل البيانات');
                setLoading(false);
            });
    }, [params]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const id = Array.isArray(params.id) ? params.id[0] : params.id;
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    totalAmount: parseFloat(formData?.totalAmount || "0"),
                    paidAmount: parseFloat(formData?.paidAmount || "0"),
                    remainingAmount: parseFloat(formData?.totalAmount || "0") - parseFloat(formData?.paidAmount || "0")
                }),
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

    const factories = facilities.filter(f => f.type === 'FACTORY');
    const shops = facilities.filter(f => f.type === 'SHOP' || f.type === 'OFFICE');

    return (
        <div className="min-h-screen bg-background p-6 flex flex-col items-center">
            <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-foreground">تعديل الطلب #{String(params.id).slice(-6)}</h1>
                    <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">رجوع</button>
                </div>

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
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">الوصف والطلبات</label>
                        <textarea
                            required
                            rows={4}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">المعرض (المصدر)</label>
                            <select
                                value={formData.shopId}
                                onChange={e => setFormData({ ...formData, shopId: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="">اختر المعرض</option>
                                {shops.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">المصنع (الهدف)</label>
                            <select
                                value={formData.factoryId}
                                onChange={e => setFormData({ ...formData, factoryId: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="">اختر المصنع</option>
                                {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">حالة الطلب</label>
                            <select
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none font-bold text-primary"
                            >
                                <option value="REGISTERED">مسجل</option>
                                <option value="PROCESSING">قيد التنفيذ</option>
                                <option value="COMPLETED">مكتمل</option>
                                <option value="DELIVERED">تم التسليم</option>
                                <option value="CANCELLED">ملغي</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">تاريخ الاستحقاق</label>
                            <input
                                required
                                type="date"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">إجمالي المبلغ (د.ل)</label>
                            <input
                                required
                                type="number"
                                step="0.01"
                                dir="ltr"
                                value={formData.totalAmount}
                                onChange={e => setFormData({ ...formData, totalAmount: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-bold focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">المبلغ المدفوع (د.ل)</label>
                            <input
                                type="number"
                                step="0.01"
                                dir="ltr"
                                value={formData.paidAmount}
                                onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-bold text-green-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
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
                            className="px-6 py-2.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-lg disabled:opacity-50"
                        >
                            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
