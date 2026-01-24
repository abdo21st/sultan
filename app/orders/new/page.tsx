"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Local state for facilities (in a real app, these would come from the API)
    // For now we will just use text inputs to keep it simple, or we could fetch them.
    // Let's try to fetch them to be "complete".
    const [facilities, setFacilities] = useState<{ id: string, name: string, type: string }[]>([]);

    useEffect(() => {
        // Fetch facilities to populate dropdowns
        fetch('/api/facilities')
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text();
                    console.error("Failed to fetch facilities:", res.status, text);
                    return [];
                }
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) setFacilities(data);
            })
            .catch(err => console.error("Failed to load facilities", err));
    }, []);

    const factories = facilities.filter(f => f.type === 'FACTORY');
    const shops = facilities.filter(f => f.type === 'SHOP');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const data = {
            customerName: formData.get("customerName"),
            customerPhone: formData.get("customerPhone"),
            description: formData.get("description"),
            dueDate: formData.get("dueDate"), // Date string
            totalAmount: formData.get("totalAmount"),
            paidAmount: formData.get("paidAmount"),
            factoryId: formData.get("factoryId"),
            shopId: formData.get("shopId"),
        };

        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                throw new Error("Failed to create order");
            }

            router.push("/"); // Redirect to dashboard
            router.refresh(); // Refresh data
        } catch (err) {
            setError("حدث خطأ ما. يرجى المحاولة مرة أخرى.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">إنشاء طلب جديد</h1>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                اسم العميل
                            </label>
                            <input
                                required
                                name="customerName"
                                type="text"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="John Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                رقم الهاتف
                            </label>
                            <input
                                required
                                name="customerPhone"
                                type="tel"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="+1 234 567 890"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            الوصف
                        </label>
                        <textarea
                            required
                            name="description"
                            rows={3}
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="تفاصيل الطلب..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                الإجمالي
                            </label>
                            <input
                                required
                                name="totalAmount"
                                type="number"
                                step="0.01"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                المدفوع
                            </label>
                            <input
                                name="paidAmount"
                                type="number"
                                step="0.01"
                                defaultValue="0"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                تاريخ الاستحقاق
                            </label>
                            <input
                                required
                                name="dueDate"
                                type="date"
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                تعيين المصنع
                            </label>
                            <select
                                name="factoryId"
                                required
                                defaultValue=""
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="" disabled>اختر مصنعاً</option>
                                {factories.length > 0 ? factories.map(f => (
                                    <option key={f.id} value={f.id}>{f.name}</option>
                                )) : <option value="default_factory">مصنع افتراضي (للاختبار)</option>}
                            </select>
                            {factories.length === 0 && <p className="text-xs text-amber-600 mt-1">لم يتم العثور على مصانع. يرجى إنشاء واحد أو استخدام الافتراضي.</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                                تعيين المعرض
                            </label>
                            <select
                                name="shopId"
                                required
                                defaultValue=""
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                                <option value="" disabled>اختر معرضاً</option>
                                {shops.length > 0 ? shops.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                )) : <option value="default_shop">معرض افتراضي (للاختبار)</option>}
                            </select>
                            {shops.length === 0 && <p className="text-xs text-amber-600 mt-1">لم يتم العثور على معارض. يرجى إنشاء واحد أو استخدام الافتراضي.</p>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors disabled:opacity-50"
                        >
                            {loading ? "جاري الإنشاء..." : "إنشاء الطلب"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
