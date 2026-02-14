'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from "../../../components/NavBar";



export default function NewUserPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        displayName: '',
        phoneNumber: '',
        role: 'USER',
        facilityId: '',
        permissions: [] as string[],
        roleIds: [] as string[]
    });

    useEffect(() => {
        setMounted(true);
    }, []);

    const [facilities, setFacilities] = useState<{ id: string, name: string, type: string }[]>([]);
    const [availableRoles, setAvailableRoles] = useState<{ id: string, displayName: string }[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        // Fetch Facilities
        fetch('/api/facilities')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setFacilities(data);
            })
            .catch(console.error);

        // Fetch Custom Roles
        fetch('/api/roles')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setAvailableRoles(data);
            })
            .catch(console.error);
    }, []);

    function toggleRole(roleId: string) {
        if (formData.roleIds.includes(roleId)) {
            setFormData({ ...formData, roleIds: formData.roleIds.filter(id => id !== roleId) });
        } else {
            setFormData({ ...formData, roleIds: [...formData.roleIds, roleId] });
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
        } catch {
            setError('حدث خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    }

    if (!mounted) return null;

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
                                type="text"
                                required
                                dir="ltr"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                className="w-full pr-10 pl-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                placeholder="username"
                                aria-label="اسم المستخدم"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">الاسم الظاهر (للموظفين)</label>
                            <input
                                required
                                name="displayName"
                                type="text"
                                value={formData.displayName}
                                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                aria-label="الاسم الظاهر"
                            />
                        </div>
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
                            aria-label="رقم الهاتف"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">كلمة المرور</label>
                        <input
                            required
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                            dir="ltr"
                            aria-label="كلمة المرور"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-medium text-muted-foreground">التخصص / الأدوار الوظيفية (يمكن اختيار أكثر من واحد)</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {availableRoles.map(role => (
                                <label key={role.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${formData.roleIds.includes(role.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                                    <input
                                        type="checkbox"
                                        checked={formData.roleIds.includes(role.id)}
                                        onChange={() => toggleRole(role.id)}
                                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                    />
                                    <span className="text-sm font-bold">{role.displayName}</span>
                                </label>
                            ))}
                        </div>
                        {availableRoles.length === 0 && (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                تنبيه: لم يتم العثور على أدوار معرفة مسبقاً. يرجى مراجعة صفحة &quot;الأدوار والصلاحيات&quot;.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">المنشأة (المكان الذي يعمل فيه)</label>
                        <select
                            name="facilityId"
                            value={formData.facilityId}
                            onChange={e => setFormData({ ...formData, facilityId: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                            aria-label="المنشأة التابع لها"
                        >
                            <option value="">-- بدون تعيين --</option>
                            {facilities.map(f => (
                                <option key={f.id} value={f.id}>
                                    {f.name} ({f.type === 'FACTORY' ? 'مصنع' : 'معرض'})
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            تحديد المنشأة يقيد الموظف بالعمل ضمن نطاقها فقط.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-12 py-4 bg-gradient-to-br from-primary to-amber-800 text-white rounded-2xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 font-bold text-base transform hover:-translate-y-0.5 hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-lg shadow-primary/20"
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>جاري الإنشاء...</span>
                                </div>
                            ) : 'إنشاء المستخدم'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
