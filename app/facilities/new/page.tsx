"use client";

import { useState } from "react";
import Link from "next/link";
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

            router.push("/facilities"); // Redirect to dashboard
            router.refresh(); // Refresh data
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "حدث خطأ ما. يرجى المحاولة مرة أخرى.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-full bg-background p-6 flex flex-col items-center">
            <div className="w-full max-w-xl bg-card rounded-xl  border border-border p-8">
                <Link href="/facilities" className="inline-flex min-h-11 items-center text-primary text-sm mb-3">العودة إلى المنشآت</Link>
                <h1 className="text-2xl font-bold mb-6 text-foreground">إضافة منشأة جديدة</h1>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="facility-name" className="block text-sm font-medium text-muted-foreground mb-1">
                            اسم المنشأة
                        </label>
                        <input
                            id="facility-name"
                            required
                            name="name"
                            type="text"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="مثال: مصنع الكيك، محل السلطان"
                        />
                    </div>

                    <div>
                        <label htmlFor="facility-type" className="block text-sm font-medium text-muted-foreground mb-1">
                            النوع
                        </label>
                        <select
                            id="facility-type"
                            name="type"
                            required
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label="نوع المنشأة"
                        >
                            <option value="FACTORY">مصنع</option>
                            <option value="SHOP">محل</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="facility-location" className="block text-sm font-medium text-muted-foreground mb-1">
                            الموقع
                        </label>
                        <input
                            id="facility-location"
                            required
                            name="location"
                            type="text"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="مثال: طرابلس"
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="ui-button"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="ui-button ui-button-primary"
                        >
                            {loading ? "جاري الإضافة..." : "إضافة المنشأة"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
