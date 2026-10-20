"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Wifi, WifiOff } from "lucide-react";
import Image from "next/image";
import { db, facilityDb, type OfflineFacility } from "@/lib/db";
import { useSession } from "next-auth/react";

export default function NewOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const { data: session } = useSession();
    const user = session?.user;
    const [facilities, setFacilities] = useState<OfflineFacility[]>([]);
    const [usingCachedFacilities, setUsingCachedFacilities] = useState(false);
    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isOnline, setIsOnline] = useState(true);
    const clientRequestId = useRef<string | null>(null);

    useEffect(() => {
        clientRequestId.current = crypto.randomUUID();
        setIsOnline(navigator.onLine);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!user || user.mustChangePassword) return;
        let active = true;
        const actor = user;
        async function loadFacilities() {
            const identity = JSON.stringify([actor.id, actor.role, actor.facilityId, actor.sessionVersion, [...actor.permissions].sort()]);
            const scope = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))))
                .map(byte => byte.toString(16).padStart(2, '0')).join('');
            if (!active) return;
            setFacilities([]);
            setUsingCachedFacilities(false);
            let cached;
            try { cached = await facilityDb.facilityCache.get('current'); } catch { /* Online creation remains available if local storage is unavailable. */ }
            if (!active) return;
            if (cached && (cached.scope !== scope || Date.now() - cached.updatedAt > 24 * 60 * 60 * 1000 || cached.updatedAt > Date.now())) {
                cached = undefined;
                try { await facilityDb.facilityCache.delete('current'); } catch { /* Never use an incompatible snapshot. */ }
            }
            try {
                const response = await fetch('/api/facilities');
                if (!active) return;
                if (response.status === 401 || response.status === 403) {
                    await facilityDb.facilityCache.clear();
                    if (active) { setFacilities([]); setError('يلزم تسجيل الدخول بصلاحية عرض المنشآت.'); }
                    return;
                }
                if (!response.ok) throw new Error('Facilities unavailable');
                const data: unknown = await response.json();
                if (!Array.isArray(data) || data.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string' || !['FACTORY', 'SHOP'].includes(item.type))) throw new Error('Invalid facilities');
                const minimal: OfflineFacility[] = data.map(item => ({ id: item.id, name: item.name, type: item.type }));
                if (!active) return;
                setFacilities(minimal);
                setUsingCachedFacilities(false);
                try { await facilityDb.facilityCache.put({ key: 'current', scope, updatedAt: Date.now(), facilities: minimal }); }
                catch { /* A storage quota failure must not disable an online form. */ }
            } catch {
                if (!active) return;
                const age = cached ? Date.now() - cached.updatedAt : Infinity;
                if (cached?.scope === scope && age >= 0 && age <= 24 * 60 * 60 * 1000) {
                    setFacilities(cached.facilities);
                    setUsingCachedFacilities(true);
                } else {
                    setFacilities([]);
                    setError('تعذر تحميل المنشآت. أعد الاتصال لفتح نموذج الطلب.');
                }
            }
        }
        void loadFacilities().catch(() => {
            if (active) { setFacilities([]); setError('تعذر تحميل المنشآت. أعد الاتصال لفتح نموذج الطلب.'); }
        });
        return () => { active = false; };
    }, [user]);

    const factories = facilities.filter(f => f.type === 'FACTORY');
    const shops = facilities.filter(f => f.type === 'SHOP');

    const assignedFacility = facilities.find(f => f.id === user?.facilityId);
    const userShopId = assignedFacility?.type === 'SHOP' ? assignedFacility.id : null;
    const userFactoryId = assignedFacility?.type === 'FACTORY' ? assignedFacility.id : null;
    const canCreateForFacility = user?.role === 'ADMIN' || Boolean(assignedFacility);

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
        setSuccess("");

        const form = e.currentTarget;
        const formData = new FormData(form);

        // Append images
        images.forEach((file) => {
            formData.append('images', file);
        });

        if (userShopId) formData.set('shopId', userShopId);
        if (userFactoryId) formData.set('factoryId', userFactoryId);
        const requestId = clientRequestId.current || crypto.randomUUID();
        clientRequestId.current = requestId;
        formData.set('clientRequestId', requestId);

        if (!isOnline) {
            try {
                // Save to IndexedDB via Dexie
                await db.orders.add({
                    customerName: formData.get('customerName') as string,
                    customerPhone: formData.get('customerPhone') as string,
                    description: formData.get('description') as string,
                    totalAmount: formData.get('totalAmount') as string,
                    paidAmount: formData.get('paidAmount') as string,
                    dueDate: formData.get('dueDate') as string,
                    factoryId: formData.get('factoryId') as string,
                    shopId: formData.get('shopId') as string,
                    images: images, // Already Blobs essentially (File extends Blob)
                    status: 'pending',
                    idempotencyKey: requestId,
                    attempts: 0,
                    nextAttemptAt: Date.now(),
                    createdAt: Date.now()
                });

                setSuccess("تم حفظ الطلب محليًا، وسيُرسل تلقائيًا عند عودة الاتصال.");
                window.dispatchEvent(new Event("sultan:offline-queue-updated"));
                form.reset();
                previews.forEach((preview) => URL.revokeObjectURL(preview));
                setImages([]);
                setPreviews([]);
                clientRequestId.current = crypto.randomUUID();
                setLoading(false);
                return;
            } catch (offlineErr) {
                console.error("Offline save failed", offlineErr);
                setError("فشل الحفظ المحلي أيضاً");
                setLoading(false);
                return;
            }
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
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-foreground">إنشاء طلب جديد</h1>
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isOnline ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500 animate-pulse'}`}>
                        {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isOnline ? 'متصل' : 'بدون إنترنت'}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-sm flex items-center gap-2">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {success && (
                    <div role="status" className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-700 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {usingCachedFacilities && <p className="mb-4 text-sm text-amber-700">تُعرض آخر قائمة منشآت محفوظة لهذا الحساب. ستُراجع الصلاحيات عند الإرسال.</p>}

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
                            {userFactoryId && user?.role !== 'ADMIN' ? (
                                <div className="w-full rounded-lg border border-input bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                                    {assignedFacility?.name}
                                    <input type="hidden" name="factoryId" value={userFactoryId} />
                                </div>
                            ) : (
                                <select name="factoryId" required defaultValue="" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" aria-label="تعيين المصنع">
                                    <option value="" disabled>اختر مصنعاً</option>
                                    {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            )}
                        </div>

                        {/* Source Shop - Auto selected if restricted */}
                        {!userShopId ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">المعرض (المصدر) - <span className="text-red-500">للإدارة فقط</span></label>
                                <select name="shopId" required defaultValue="" className="w-full rounded-lg border border-input bg-background/50 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none" aria-label="المعرض المصدر">
                                    <option value="" disabled>اختر معرضاً</option>
                                    {shops.map(s => (
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
                        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 text-sm font-medium bg-muted text-foreground hover:bg-muted/80 rounded-lg transition-all">إلغاء</button>
                        <button type="submit" disabled={loading || !canCreateForFacility} className="px-6 py-2.5 text-sm font-medium text-white bg-amber-700 hover:bg-amber-600 hover:scale-105 rounded-lg shadow-sm transition-all disabled:opacity-50">
                            {loading ? "جاري الإنشاء..." : "إنشاء الطلب"}
                        </button>
                    </div>
                    {user && !canCreateForFacility && <p className="text-sm text-red-600 text-left">يجب إسنادك إلى منشأة قبل إنشاء طلب.</p>}
                </form>
            </div>
        </div>
    );
}
