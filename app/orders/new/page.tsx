"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, X, Wifi, WifiOff } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";

type Facility = { id: string; name: string; type: "FACTORY" | "SHOP" };

export default function NewOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const { data: session } = useSession();
    const user = session?.user;
    const [facilities, setFacilities] = useState<Facility[]>([]);

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
        if (!user || user.mustChangePassword || !isOnline) return;
        let active = true;
        const abort = new AbortController();
        async function loadFacilities() {
            try {
                const response = await fetch('/api/facilities', { cache: 'no-store', signal: abort.signal });
                if (!active) return;
                if (response.status === 401 || response.status === 403) {
                    setFacilities([]); setError('يلزم تسجيل الدخول بصلاحية عرض المنشآت.'); return;
                }
                if (!response.ok) throw new Error('Facilities unavailable');
                const data: unknown = await response.json();
                if (!Array.isArray(data) || data.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string' || !['FACTORY', 'SHOP'].includes(item.type))) throw new Error('Invalid facilities');
                if (active) setFacilities(data.map(item => ({ id: item.id, name: item.name, type: item.type })));
            } catch {
                if (active) { setFacilities([]); setError('تعذر تحميل المنشآت. أعد الاتصال ثم افتح نموذج الطلب.'); }
            }
        }
        void loadFacilities();
        return () => { active = false; abort.abort(); };
    }, [user, isOnline]);
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

        if (!isOnline || !navigator.onLine) {
            setError('يلزم الاتصال بالإنترنت لإنشاء الطلب.');
            setLoading(false);
            return;
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
            setError(err instanceof TypeError ? "تعذر تأكيد الحفظ من الخادم. أعد المحاولة عند عودة الاتصال." : err instanceof Error ? err.message : "حدث خطأ ما");
        } finally {
            setLoading(false);
        }
    }

    if (!user) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

    return <main className="ui-page max-w-5xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-primary min-h-11"><ArrowRight size={18} aria-hidden="true" />العودة إلى الطلبات</Link>
        <header className="ui-page-header"><div><h1 className="ui-page-title">طلب جديد</h1><p className="ui-page-description">الحقول المعلّمة بـ * مطلوبة.</p></div><span className={`flex items-center gap-2 text-sm ${isOnline ? 'text-emerald-800' : 'text-red-700'}`}>{isOnline ? <Wifi size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}{isOnline ? 'متصل' : 'بدون إنترنت'}</span></header>
        {error && <div role="alert" className="ui-card text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="ui-card space-y-4"><legend className="px-2 text-base font-semibold">بيانات العميل</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label><span className="ui-field-label">اسم العميل *</span><input required name="customerName" type="text" autoComplete="name" className="ui-field" placeholder="اسم العميل" /></label>
                    <label><span className="ui-field-label">رقم الهاتف *</span><input required name="customerPhone" type="tel" autoComplete="tel" dir="ltr" className="ui-field" placeholder="09xxxxxxxx" /></label>
                </div>
            </fieldset>
            <fieldset className="ui-card space-y-4"><legend className="px-2 text-base font-semibold">تفاصيل الطلب</legend>
                <label className="block"><span className="ui-field-label">الوصف *</span><textarea required name="description" rows={4} className="ui-field" placeholder="تفاصيل الأثاث والمقاسات والملاحظات" /></label>
                <div><label htmlFor="order-images" className="ui-field-label">صور الطلب — حتى 3 صور</label><input id="order-images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageChange} className="ui-field" /><p className="mt-2 text-xs text-muted-foreground">اختياري · صورة لا تزيد عن 4.5 ميجابايت.</p></div>
                {previews.length > 0 && <div className="flex flex-wrap gap-3">{previews.map((src, index) => <div key={src} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border"><Image src={src} alt={`معاينة الصورة ${index + 1}`} width={96} height={96} className="w-full h-full object-cover" /><button type="button" onClick={() => removeImage(index)} className="absolute top-0 left-0 bg-card text-red-700 w-11 h-11 flex items-center justify-center" aria-label={`حذف الصورة ${index + 1}`}><X size={18} aria-hidden="true" /></button></div>)}</div>}
            </fieldset>
            <fieldset className="ui-card space-y-4"><legend className="px-2 text-base font-semibold">المبالغ</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label><span className="ui-field-label">الإجمالي بالدينار الليبي *</span><input required name="totalAmount" type="number" min="0.01" step="0.01" inputMode="decimal" dir="ltr" className="ui-field" placeholder="0.00" /></label>
                    <label><span className="ui-field-label">المدفوع بالدينار الليبي</span><input name="paidAmount" type="number" min="0" step="0.01" defaultValue="0" inputMode="decimal" dir="ltr" className="ui-field" /></label>
                </div>
            </fieldset>
            <fieldset className="ui-card space-y-4"><legend className="px-2 text-base font-semibold">التنفيذ والتسليم</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label><span className="ui-field-label">تاريخ الاستحقاق *</span><input required name="dueDate" type="date" min={new Date().toISOString().split('T')[0]} className="ui-field" aria-label="تاريخ الاستحقاق" /></label>
                    <div><label htmlFor="order-factory" className="ui-field-label">المصنع المنفذ *</label>{userFactoryId && user.role !== 'ADMIN' ? <div className="ui-field bg-muted">{assignedFacility?.name}<input type="hidden" name="factoryId" value={userFactoryId} /></div> : <select id="order-factory" name="factoryId" required defaultValue="" className="ui-field"><option value="" disabled>اختر مصنعاً</option>{factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select>}</div>
                    <div><label htmlFor="order-shop" className="ui-field-label">المعرض *</label>{userShopId ? <div className="ui-field bg-muted">{facilities.find(facility => facility.id === userShopId)?.name}<input type="hidden" name="shopId" value={userShopId} /></div> : <select id="order-shop" name="shopId" required defaultValue="" className="ui-field"><option value="" disabled>اختر معرضاً</option>{shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>}</div>
                </div>
            </fieldset>
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4"><Link href="/" className="ui-button">إلغاء</Link><button type="submit" disabled={loading || !isOnline || facilities.length === 0 || !canCreateForFacility} className="ui-button ui-button-primary">{loading ? 'جاري إنشاء الطلب...' : 'إنشاء الطلب'}</button></div>
            {!canCreateForFacility && <p className="text-sm text-red-700">يجب إسنادك إلى منشأة قبل إنشاء طلب.</p>}
        </form>
    </main>;
}
