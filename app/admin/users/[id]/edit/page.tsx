'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import NavBar from '@/app/components/NavBar';
import { User, Shield, Briefcase, Lock, Save } from 'lucide-react';

// Define available permissions
const AVAILABLE_PERMISSIONS = [
    { id: 'MANAGE_USERS', label: 'إدارة المستخدمين' },
    { id: 'MANAGE_ORDERS', label: 'إدارة الطلبات' },
    { id: 'VIEW_REPORTS', label: 'عرض التقارير' },
    { id: 'MANAGE_SETTINGS', label: 'إعدادات النظام' },
];

export default function EditUserPage() {
    const router = useRouter();
    const params = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [facilities, setFacilities] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        username: '',
        password: '', // Optional for edit
        displayName: '',
        phoneNumber: '',
        role: 'EMPLOYEE',
        facilityId: '',
        permissions: [] as string[]
    });

    useEffect(() => {
        // Fetch facilities
        fetch('/api/facilities').then(res => res.json()).then(data => setFacilities(data)).catch(() => { });

        // Fetch user data
        if (!params?.id) return;
        const id = Array.isArray(params.id) ? params.id[0] : params.id;

        fetch(`/api/users/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('User not found');
                return res.json();
            })
            .then(data => {
                setFormData({
                    username: data.username,
                    password: '', // Don't show password
                    displayName: data.displayName,
                    phoneNumber: data.phoneNumber || '',
                    role: data.role,
                    facilityId: data.facilityId || '',
                    permissions: data.permissions || []
                });
                setLoading(false);
            })
            .catch(err => {
                setError('فشل تحميل بيانات المستخدم');
                setLoading(false);
            });
    }, [params]);

    function togglePermission(perm: string) {
        if (formData.permissions.includes(perm)) {
            setFormData({ ...formData, permissions: formData.permissions.filter(p => p !== perm) });
        } else {
            setFormData({ ...formData, permissions: [...formData.permissions, perm] });
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            const id = Array.isArray(params.id) ? params.id[0] : params.id;
            // Only send password if it's not empty
            const body: any = { ...formData };
            if (!body.password) delete body.password;

            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                router.push('/admin/users');
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || 'فشل تحديث المستخدم');
            }
        } catch (err) {
            setError('حدث خطأ أثناء التحديث');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-background">
            <NavBar />

            <main className="max-w-3xl mx-auto px-4 py-8">
                <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">تعديل بيانات المستخدم</h1>
                            <p className="text-muted-foreground">تحديث البيانات والصلاحيات</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                البيانات الأساسية
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">اسم العرض</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.displayName}
                                        onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="مثال: أحمد محمد"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">رقم الهاتف (للتنبيهات)</label>
                                    <input
                                        type="tel"
                                        dir="ltr"
                                        value={formData.phoneNumber}
                                        onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="2189xxxxxxx"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">اسم المستخدم</label>
                                    <input
                                        type="text"
                                        required
                                        dir="ltr"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="username"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                    <span>كلمة المرور</span>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">اتركها فارغة إذا لم ترد التغيير</span>
                                </label>
                                <div className="relative">
                                    <Lock className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <input
                                        type="password"
                                        dir="ltr"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full pr-10 pl-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-border my-6"></div>

                        {/* Role & Facility */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                <Briefcase className="w-4 h-4" />
                                الوظيفة والمنشأة
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">الدور الوظيفي</label>
                                    <select
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                        aria-label="الدور الوظيفي"
                                    >
                                        <option value="EMPLOYEE">موظف (Employee)</option>
                                        <option value="ACCOUNTANT">محاسب (Accountant)</option>
                                        <option value="MANAGER">مدير (Manager)</option>
                                        <option value="ADMIN">مدير نظام (Admin)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground">المنشأة التابع لها</label>
                                    <select
                                        value={formData.facilityId}
                                        onChange={e => setFormData({ ...formData, facilityId: e.target.value })}
                                        className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                        aria-label="المنشأة التابع لها"
                                    >
                                        <option value="">غير محدد</option>
                                        {facilities.map(facility => (
                                            <option key={facility.id} value={facility.id}>
                                                {facility.type === 'FACTORY' ? '🏭' : '🏪'} {facility.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">يحدد هذا الخيار المكان الذي يعمل فيه الموظف والطلبات التي يمكنه رؤيتها.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg transition-all disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                            </button>
                        </div>

                    </form>
                </div>
            </main>
        </div>
    );
}
