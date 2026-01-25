"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewFacilityPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError("");

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get("name"),
            type: formData.get("type"), // FACTORY or SHOP
            location: formData.get("location"),
        };

        try {
            const res = await fetch("/api/facilities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "فشل إضافة المنشأة");
            }

            router.push("/"); // Redirect to dashboard
            router.refresh(); // Refresh data
        } catch {
            setError("حدث خطأ ما. يرجى المحاولة مرة أخرى.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black p-6 flex flex-col items-center">
            <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                <h1 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-white">إضافة منشأة جديدة</h1>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            اسم المنشأة
                        </label>
                        <input
                            required
                            name="name"
                            type="text"
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="مثال: المصنع الرئيسي، معرض وسط البلد"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            النوع
                        </label>
                        <select
                            name="type"
                            required
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            aria-label="نوع المنشأة"
                        >
                            <option value="FACTORY">مصنع</option>
                            <option value="SHOP">معرض</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            الموقع
                        </label>
                        <input
                            required
                            name="location"
                            type="text"
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="مثال: القاهرة، الجيزة"
                        />
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
                            {loading ? "جاري الإضافة..." : "إضافة المنشأة"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
