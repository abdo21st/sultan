'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                throw new Error('فشل إنشاء المستخدم');
            }

            router.push('/admin/users');
            router.refresh();
        } catch (err) {
            setError('حدث خطأ أثناء إنشاء المستخدم');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-background p-6 flex justify-center items-start pt-20">
            <div className="w-full max-w-lg bg-card border border-border rounded-xl p-8 shadow-sm">
                <h1 className="text-2xl font-bold mb-6 text-foreground">إضافة مستخدم جديد</h1>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground mr-1">
                            اسم المستخدم (للدخول)
                        </label>
                        <input
                            name="username"
                            type="text"
                            required
                            dir="ltr"
                            className="w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            placeholder="username"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground mr-1">
                            الاسم الكامل
                        </label>
                        <input
                            name="displayName"
                            type="text"
                            required
                            className="w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            placeholder="فلان الفلاني"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground mr-1">
                            كلمة المرور
                        </label>
                        <input
                            name="password"
                            type="password"
                            required
                            dir="ltr"
                            className="w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground mr-1">
                            الدور (Role)
                        </label>
                        <select
                            name="role"
                            required
                            className="w-full rounded-lg border border-input bg-background/50 px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="USER">مستخدم (User)</option>
                            <option value="MANAGER">مدير فرع (Manager)</option>
                            <option value="ACCOUNTANT">محاسب (Accountant)</option>
                            <option value="ADMIN">مدير نظام (Admin)</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-amber-600 rounded-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                        >
                            {loading ? 'جاري الحفظ...' : 'حفظ المستخدم'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
