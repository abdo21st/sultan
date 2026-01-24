'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../../components/NavBar'; // Updated import path

// Define available permissions
const AVAILABLE_PERMISSIONS = [
    { id: 'MANAGE_USERS', label: 'إدارة المستخدمين' },
    { id: 'VIEW_REPORTS', label: 'عرض التقارير المالية' },
    { id: 'DELETE_ORDERS', label: 'حذف الطلبات' },
    { id: 'EDIT_SETTINGS', label: 'تعديل إعدادات النظام' },
];

export default function NewUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        displayName: '',
        role: 'USER',
        permissions: [] as string[]
    });

    const [error, setError] = useState('');

    function togglePermission(permId: string) {
        if (formData.permissions.includes(permId)) {
            setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== permId) });
        } else {
            setFormData({ ...formData, permissions: [...formData.permissions, permId] });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                router.push('/admin/users');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || 'فشل إنشاء المستخدم');
            }
        } catch (err) {
            setError('حدث خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <NavBar />
            <div className="max-w-2xl mx-auto py-10 px-4">
                <h1 className="text-2xl font-bold mb-6 text-foreground">إضافة مستخدم جديد</h1>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-xl border border-border shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">اسم المستخدم</label>
                            <input
                                required
                                type="text"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                dir="ltr"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">الاسم الظاهر (للموظفين)</label>
                            <input
                                required
                                type="text"
                                value={formData.displayName}
                                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">كلمة المرور</label>
                        <input
                            required
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            dir="ltr"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">الدور الوظيفي</label>
                        <select
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        >
                            <option value="USER">مستخدم عادي (User)</option>
                            <option value="ACCOUNTANT">محاسب (Accountant)</option>
                            <option value="MANAGER">مشرف (Manager)</option>
                            <option value="ADMIN">مدير نظام (Admin)</option>
                        </select>
                    </div>

                    {/* Advanced Permissions Section */}
                    <div className="pt-4 border-t border-border">
                        <h3 className="font-semibold mb-3 text-foreground">الصلاحيات الإضافية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {AVAILABLE_PERMISSIONS.map(perm => (
                                <label key={perm.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.permissions.includes(perm.id)}
                                        onChange={() => togglePermission(perm.id)}
                                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                    />
                                    <span className="text-sm">{perm.label}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            ملاحظة: المدير (Admin) يملك جميع الصلاحيات تلقائياً.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2 bg-primary text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
