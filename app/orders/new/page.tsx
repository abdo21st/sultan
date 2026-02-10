"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import Image from "next/image";

export default function NewOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<{ id: string; role: string; facilityId?: string } | null>(null);
    const [facilities, setFacilities] = useState<{ id: string, name: string, type: string }[]>([]);
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);

    useEffect(() => {
        // Fetch session
        fetch('/api/auth/session').then(res => res.json()).then(data => {
            if (data?.user) setUser(data.user);
        });

        // Fetch facilities
        fetch('/api/facilities')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setFacilities(data);
            })
            .catch(err => console.error("Failed to load facilities", err));
    }, []);

    const factories = facilities.filter(f => f.type === 'FACTORY');

    // Determine source shop:
    // If user has facilityId, use it. Otherwise allow selection (if admin). 
    // If user is restricted to a FACTORY, they shouldn't be here? 
    // "Employee in shop registers order" -> so we assume user is in SHOP.
    const userShopId = user?.facilityId;
    const isRestricted = !!userShopId;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            if (images.length + newFiles.length > 3) {
                alert("يمكنك رفع 3 صور كحد أقصى");
                return;
            }
            setImages([...images, ...newFiles]);

            // Generate previews
            const newPreviews = newFiles.map(file => URL.createObjectURL(file));
            setPreviews([...previews, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);

        const newPreviews = [...previews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);

        // Append images
        images.forEach((file) => {
            formData.append('images', file);
        });

        // If restricted, ensure shopId is set
        if (isRestricted) {
            formData.set('shopId', userShopId);
        }

        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                body: formData, // Send as FormData
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "فشل إنشاء الطلب");
            }

            router.push("/");
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "حدث خطأ ما");
        } finally {
            setLoading(false);
        }
    }

    if (!user) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-background p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl bg-card rounded-xl shadow-sm border border-border p-8">
                <h1 className="text-2xl font-bold mb-6 text-foreground">إنشاء طلب جديد</h1>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-sm flex items-center gap-2">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">اسم العميل</label>
                            <input required name="customerName" type="text" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="اسم العميل الرباعي" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">رقم الهاتف</label>
                            <input required name="customerPhone" type="tel" dir="ltr" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none font-mono" placeholder="09xxxxxxxx" />
                        </div>
                    </div>

                    {/* Order Details */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">الوصف</label>
                        <textarea required name="description" rows={3} className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm resize-none focus:ring-1 focus:ring-primary outline-none" placeholder="تفاصيل الطلب..." />
                    </div>

                    {/* Images Upload */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">صور الطلب (حد أقصى 3)</label>
                        <div className="flex flex-wrap gap-4">
                            {previews.map((src, idx) => (
                                <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border group">
                                    <Image src={src} alt="preview" width={96} height={96} className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="حذف الصورة">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {images.length < 3 && (
                                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                                    <Upload className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground mt-1">رفع صورة</span>
                                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Financials */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">الإجمالي</label>
                            <input required name="totalAmount" type="number" step="0.01" dir="ltr" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary outline-none" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">المدفوع</label>
                            <input name="paidAmount" type="number" step="0.01" defaultValue="0" dir="ltr" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary outline-none" placeholder="0.00" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">تاريخ الاستحقاق</label>
                            <input required name="dueDate" type="date" min={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" aria-label="تاريخ الاستحقاق" />
                        </div>
                    </div>

                    {/* Facility Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">تعيين المصنع (الهدف)</label>
                            <select name="factoryId" required defaultValue="" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" aria-label="تعيين المصنع">
                                <option value="" disabled>اختر مصنعاً</option>
                                {factories.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Source Shop - Auto selected if restricted */}
                        {!isRestricted ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">المعرض (المصدر) - <span className="text-red-500">للإدارة فقط</span></label>
                                <select name="shopId" required defaultValue="" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" aria-label="المعرض المصدر">
                                    <option value="" disabled>اختر معرضاً</option>
                                    {facilities.filter(f => f.type === 'SHOP').map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className="space-y-2 opacity-75">
                                <label className="text-sm font-medium text-muted-foreground">المعرض (المصدر)</label>
                                <div className="w-full rounded-lg border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                                    {facilities.find(f => f.id === userShopId)?.name || 'جاري التحميل...'}
                                    <input type="hidden" name="shopId" value={userShopId} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-border">
                        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors">إلغاء</button>
                        <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-medium text-white bg-primary hover:bg-amber-600 rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                            {loading ? "جاري الإنشاء..." : "إنشاء الطلب"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
