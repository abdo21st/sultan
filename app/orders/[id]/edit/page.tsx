'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from '@/lib/constants';

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
    images: string[];
}

export default function EditOrderPage() {
    const router = useRouter();
    const params = useParams();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [formData, setFormData] = useState<OrderFormData | null>(null);
    const [newImages, setNewImages] = useState<File[]>([]);
    const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);

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
                if (facilitiesData.error) throw new Error(facilitiesData.error);
                if (orderData.error) throw new Error(orderData.error);

                setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
                setFormData({
                    ...orderData,
                    totalAmount: String(orderData.totalAmount || 0),
                    paidAmount: String(orderData.paidAmount || 0),
                    dueDate: orderData.dueDate ? new Date(orderData.dueDate).toISOString().split('T')[0] : '',
                    images: orderData.images || [],
                });
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                setError(err instanceof Error ? err.message : 'فشل تحميل البيانات');
                setLoading(false);
            });
    }, [params]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setNewImages(prev => [...prev, ...files]);

            const previews = files.map(file => URL.createObjectURL(file));
            setNewImagePreviews(prev => [...prev, ...previews]);
        }
    };

    const removeExistingImage = (index: number) => {
        if (!formData) return;
        const updatedImages = [...formData.images];
        updatedImages.splice(index, 1);
        setFormData({ ...formData, images: updatedImages });
    };

    const removeNewImage = (index: number) => {
        const updatedFiles = [...newImages];
        updatedFiles.splice(index, 1);
        setNewImages(updatedFiles);

        const updatedPreviews = [...newImagePreviews];
        URL.revokeObjectURL(updatedPreviews[index]);
        updatedPreviews.splice(index, 1);
        setNewImagePreviews(updatedPreviews);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData) return;

        setSaving(true);
        setError('');

        try {
            const id = Array.isArray(params.id) ? params.id[0] : params.id;
            const submitData = new FormData();

            submitData.append("customerName", formData.customerName);
            submitData.append("customerPhone", formData.customerPhone);
            submitData.append("description", formData.description);
            let statusToSubmit = formData.status;
            if (statusToSubmit === ORDER_STATUS.REVIEW) {
                statusToSubmit = ORDER_STATUS.REGISTERED;
            }

            submitData.append("status", statusToSubmit);
            submitData.append("totalAmount", formData.totalAmount);
            submitData.append("paidAmount", formData.paidAmount);
            submitData.append("dueDate", formData.dueDate);
            submitData.append("factoryId", formData.factoryId);
            submitData.append("shopId", formData.shopId);
            submitData.append("existingImages", JSON.stringify(formData.images));

            newImages.forEach(file => {
                submitData.append("newImages", file);
            });

            // IMPORTANT: Do NOT set Content-Type header when sending FormData
            const res = await fetch(`/api/orders/${id}`, {
                method: 'PATCH',
                body: submitData,
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Update failed');
            }

            router.push('/');
            router.refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'فشل تحديث الطلب';
            setError(message);
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
    if (error === 'Unauthorized') return <div className="p-8 text-center text-destructive font-bold">عذراً، ليس لديك صلاحية تعديل الطلبات.</div>;
    if (!formData) return <div className="p-8 text-center text-destructive">الطلب غير موجود</div>;

    const factories = Array.isArray(facilities) ? facilities.filter(f => f.type === 'FACTORY') : [];
    const shops = Array.isArray(facilities) ? facilities.filter(f => f.type === 'SHOP' || f.type === 'OFFICE') : [];

    return (
        <div className="min-h-screen bg-background p-6 flex flex-col items-center">
            <div className="w-full max-w-3xl bg-card border border-border rounded-xl p-8 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-foreground">تعديل الطلب #{String(params.id).slice(-6)}</h1>
                    <button type="button" onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">رجوع</button>
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
                                aria-label="اسم العميل"
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
                                aria-label="رقم الهاتف"
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
                            aria-label="الوصف والطلبات"
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
                                aria-label="المعرض المصدر"
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
                                aria-label="المصنع الهدف"
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
                                aria-label="حالة الطلب"
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none font-bold text-primary"
                            >
                                {Object.entries(ORDER_STATUS).map(([key, value]) => (
                                    <option key={key} value={value}>
                                        {ORDER_STATUS_LABELS[value]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">تاريخ الاستحقاق</label>
                            <input
                                required
                                type="date"
                                aria-label="تاريخ الاستحقاق"
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
                                aria-label="إجمالي المبلغ"
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
                                aria-label="المبلغ المدفوع"
                                value={formData.paidAmount}
                                onChange={e => setFormData({ ...formData, paidAmount: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm font-bold text-green-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    {/* Image Management */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <h3 className="font-bold text-foreground">إدارة الصور المرفقة</h3>

                        {/* Existing Images */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {formData.images.map((img, idx) => (
                                <div key={`old-${idx}`} className="group relative aspect-video rounded-lg border border-border overflow-hidden bg-muted shadow-sm">
                                    <Image src={img} alt="Order" fill className="object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeExistingImage(idx)}
                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="حذف الصورة"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}

                            {/* New Previews */}
                            {newImagePreviews.map((preview, idx) => (
                                <div key={`new-${idx}`} className="group relative aspect-video rounded-lg border border-primary/30 overflow-hidden bg-muted shadow-sm">
                                    <Image src={preview} alt="New Preview" fill className="object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => removeNewImage(idx)}
                                        className="absolute top-1 right-1 bg-black/60 hover:bg-destructive/90 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                        title="إزالة المرفق الجديد"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                    <div className="absolute bottom-0 inset-x-0 bg-primary text-[10px] text-white text-center py-0.5">جديد</div>
                                </div>
                            ))}

                            {/* Add More Button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="12 4v16m8-8H4" />
                                </svg>
                                <span className="text-xs">إضافة صور</span>
                            </button>
                        </div>

                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            aria-label="رفع صور جديدة"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
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
                            className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-lg disabled:opacity-50"
                        >
                            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
