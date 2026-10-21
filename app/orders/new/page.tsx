"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, X, Wifi, WifiOff } from "lucide-react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from '@/lib/permissions';
import { libyaDateKey } from '@/lib/calendar-date';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/app/components/ToastProvider';

type Facility = { id: string; name: string; type: "FACTORY" | "SHOP" };

export default function NewOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const { showToast } = useToast();
    const [totalInput, setTotalInput] = useState('');
    const [paidInput, setPaidInput] = useState('0');
    const [selectedFactory, setSelectedFactory] = useState('');
    const [selectedShop, setSelectedShop] = useState('');
    const [dueDate, setDueDate] = useState('');
    const previewUrls = useRef(new Set<string>());

    const { data: session } = useSession();
    const user = session?.user;
    const [facilities, setFacilities] = useState<Facility[]>([]);

    const [images, setImages] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isOnline, setIsOnline] = useState(true);
    const clientRequestId = useRef<string | null>(null);
    useEffect(() => { const urls = previewUrls.current; return () => { urls.forEach(url => URL.revokeObjectURL(url)); }; }, []);

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
        const timeout = setTimeout(() => abort.abort(), 20000);
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
            } finally { clearTimeout(timeout); }
        }
        void loadFacilities();
        return () => { active = false; clearTimeout(timeout); abort.abort(); };
    }, [user, isOnline]);
    const factories = facilities.filter(f => f.type === 'FACTORY');
    const shops = facilities.filter(f => f.type === 'SHOP');

    const assignedFacility = facilities.find(f => f.id === user?.facilityId);
    const allFacilities = user?.role === 'ADMIN' || Boolean(user?.permissions?.includes(PERMISSIONS.FACILITIES_VIEW_ALL));
    const userShopId = !allFacilities && assignedFacility?.type === 'SHOP' ? assignedFacility.id : null;
    const userFactoryId = !allFacilities && assignedFacility?.type === 'FACTORY' ? assignedFacility.id : null;
    const canCreateForFacility = allFacilities || Boolean(assignedFacility);
    const canCollect = user?.role === 'ADMIN' || Boolean(user?.permissions?.includes(PERMISSIONS.ORDERS_VIEW_FINANCIALS) && user?.permissions?.includes(PERMISSIONS.TRANSACTIONS_ADD));
    const previewTotal = Number(totalInput || 0);
    const previewPaid = canCollect ? Number(paidInput || 0) : 0;
    const factoryName = facilities.find(facility => facility.id === (userFactoryId || selectedFactory))?.name;
    const shopName = facilities.find(facility => facility.id === (userShopId || selectedShop))?.name;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            if (images.length + newFiles.length > 3) {
                setError('يمكن إرفاق ٣ صور كحد أقصى.');
                return;
            }
            if (newFiles.some(file => file.size > 4.5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))) {
                setError('اختر صور JPEG أو PNG أو WebP أو GIF، بحجم لا يتجاوز ٤٫٥ ميجابايت للصورة.');
                e.target.value = '';
                return;
            }
            setError('');
            setImages([...images, ...newFiles]);

            // Generate previews
            const newPreviews = newFiles.map(file => { const url = URL.createObjectURL(file); previewUrls.current.add(url); return url; });
            setPreviews([...previews, ...newPreviews]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);

        const newPreviews = [...previews];
        URL.revokeObjectURL(newPreviews[index]);
        previewUrls.current.delete(newPreviews[index]);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");


        const form = e.currentTarget;
        const formData = new FormData(form);
        if (!canCollect) formData.set('paidAmount', '0');

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

            const saved = await res.json();
            showToast('تم تسجيل الطلب. يمكنك متابعة مرحلته من صفحة التفاصيل.', 'success');
            router.push(typeof saved.id === 'string' ? `/orders/${saved.id}` : '/');
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof TypeError ? "تعذر تأكيد الحفظ من الخادم. أعد المحاولة عند عودة الاتصال." : err instanceof Error ? err.message : "حدث خطأ ما");
        } finally {
            setLoading(false);
        }
    }

    if (!user) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;

    return <main className="ui-page max-w-6xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-primary min-h-11"><ArrowRight size={18} aria-hidden="true" />العودة إلى الطلبات</Link>
        <header className="ui-page-header"><div><p className="ui-eyebrow">تسجيل الطلب</p><h1 className="ui-page-title">طلب جديد</h1><p className="ui-page-description">أدخل البيانات، وراجع الملخص قبل الحفظ. الحقول المعلّمة بـ * مطلوبة.</p></div><span className={`flex items-center gap-2 text-xs ${isOnline ? 'text-emerald-800' : 'text-red-700'}`}>{isOnline ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}{isOnline ? 'متصل بالإنترنت' : 'بدون إنترنت'}</span></header>
        {error && <div role="alert" className="ui-feedback ui-feedback-error">{error}</div>}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
            <div className="min-w-0 space-y-6">
            <fieldset className="ui-card order-form-section space-y-4"><legend><span aria-hidden="true">١</span>بيانات العميل</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label><span className="ui-field-label">اسم العميل *</span><input required name="customerName" type="text" autoComplete="name" className="ui-field" placeholder="اسم العميل" /></label>
                    <label><span className="ui-field-label">رقم الهاتف *</span><input required name="customerPhone" type="tel" autoComplete="tel" dir="ltr" className="ui-field" placeholder="09xxxxxxxx" /></label>
                </div>
            </fieldset>
            <fieldset className="ui-card order-form-section space-y-4"><legend><span aria-hidden="true">٢</span>تفاصيل الطلب</legend>
                <label className="block"><span className="ui-field-label">الوصف *</span><textarea required name="description" rows={4} className="ui-field" placeholder="نوع المنتج، العدد أو الحجم، والمواصفات المطلوبة" /></label>
                <div><label htmlFor="order-images" className="ui-field-label">صور الطلب — حتى 3 صور</label><input id="order-images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageChange} className="ui-field" /><p className="mt-2 text-xs text-muted-foreground">اختياري · صورة لا تزيد عن 4.5 ميجابايت.</p></div>
                {previews.length > 0 && <div className="flex flex-wrap gap-3">{previews.map((src, index) => <div key={src} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border"><Image src={src} alt={`معاينة الصورة ${index + 1}`} width={96} height={96} className="w-full h-full object-cover" /><button type="button" onClick={() => removeImage(index)} className="absolute top-0 left-0 bg-card text-red-700 w-11 h-11 flex items-center justify-center" aria-label={`حذف الصورة ${index + 1}`}><X size={18} aria-hidden="true" /></button></div>)}</div>}
            </fieldset>
            <fieldset className="ui-card order-form-section space-y-4"><legend><span aria-hidden="true">٣</span>المبالغ</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label><span className="ui-field-label">الإجمالي بالدينار الليبي *</span><input required name="totalAmount" type="number" min="0.01" step="0.01" inputMode="decimal" dir="ltr" className="ui-field" placeholder="0.00" value={totalInput} onChange={event => setTotalInput(event.target.value)} /></label>
                    {canCollect && <label><span className="ui-field-label">المدفوع بالدينار الليبي</span><input name="paidAmount" type="number" min="0" max={totalInput || undefined} step="0.01" value={paidInput} onChange={event => setPaidInput(event.target.value)} inputMode="decimal" dir="ltr" className="ui-field" /><span className="block text-xs text-muted-foreground mt-2">أدخل المبلغ المقبوض فعلياً فقط.</span></label>}
                </div>
            </fieldset>
            <fieldset className="ui-card order-form-section space-y-4"><legend><span aria-hidden="true">٤</span>التنفيذ والتسليم</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label><span className="ui-field-label">موعد التسليم *</span><input required name="dueDate" type="date" min={libyaDateKey()} className="ui-field" value={dueDate} onChange={event => setDueDate(event.target.value)} /></label>
                    <div><label htmlFor="order-factory" className="ui-field-label">المصنع المنفذ *</label>{userFactoryId && user.role !== 'ADMIN' ? <div className="ui-field bg-muted">{assignedFacility?.name}<input type="hidden" name="factoryId" value={userFactoryId} /></div> : <select id="order-factory" name="factoryId" required value={selectedFactory} onChange={event => setSelectedFactory(event.target.value)} className="ui-field"><option value="" disabled>اختر مصنعاً</option>{factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select>}</div>
                    <div><label htmlFor="order-shop" className="ui-field-label">محل تسجيل الطلب *</label>{userShopId ? <div className="ui-field bg-muted">{facilities.find(facility => facility.id === userShopId)?.name}<input type="hidden" name="shopId" value={userShopId} /></div> : <select id="order-shop" name="shopId" required value={selectedShop} onChange={event => setSelectedShop(event.target.value)} className="ui-field"><option value="" disabled>اختر محلاً</option>{shops.map(shop => <option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>}</div>
                </div>
            </fieldset>
            </div>
            <aside className="order-form-aside" aria-label="ملخص الطلب قبل الحفظ"><h2 className="font-bold flex items-center gap-2"><Check size={18} aria-hidden="true" />راجع قبل الحفظ</h2><p className="text-xs text-muted-foreground mt-2 leading-relaxed">يبدأ الطلب بمرحلة «مسجّل» بعد حفظه بنجاح.</p><dl><div><dt>المحل</dt><dd>{shopName || 'لم يُحدد'}</dd></div><div><dt>المصنع</dt><dd>{factoryName || 'لم يُحدد'}</dd></div><div><dt>موعد التسليم</dt><dd><bdi>{dueDate || 'لم يُحدد'}</bdi></dd></div><div><dt>قيمة الطلب</dt><dd><bdi>{totalInput ? formatCurrency(previewTotal) : '—'}</bdi></dd></div>{canCollect && <div><dt>المدفوع</dt><dd><bdi>{formatCurrency(previewPaid)}</bdi></dd></div>}<div className="border-t border-border pt-4"><dt>المتبقي</dt><dd className="text-primary"><bdi>{totalInput ? formatCurrency(previewTotal - previewPaid) : '—'}</bdi></dd></div></dl><div className="order-form-submit mt-6"><button type="submit" disabled={loading || !isOnline || facilities.length === 0 || !canCreateForFacility} className="ui-button ui-button-primary w-full">{loading ? 'جاري إنشاء الطلب...' : 'إنشاء الطلب'}</button><Link href="/" className="ui-button w-full">إلغاء</Link></div></aside>
            {!canCreateForFacility && <p className="text-sm text-red-700">يجب إسنادك إلى منشأة قبل إنشاء طلب.</p>}
        </form>
    </main>;
}
