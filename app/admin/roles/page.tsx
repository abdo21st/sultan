
'use client';

import { useState, useEffect } from 'react';
import NavBar from '../../components/NavBar';
import { PERMISSIONS, PERMISSION_LABELS } from '../../../lib/permissions';

interface Role {
    id: string;
    name: string;
    displayName: string;
    permissions: string[];
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRole, setEditingRole] = useState<Role | { id: 'new' } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        displayName: '',
        permissions: [] as string[]
    });

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            const res = await fetch('/api/roles');
            const data = await res.json();
            if (Array.isArray(data)) setRoles(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            displayName: role.displayName,
            permissions: role.permissions || []
        });
    };

    const handleCreate = () => {
        setEditingRole({ id: 'new' }); // Dummy object for "new" mode
        setFormData({
            name: '',
            displayName: '',
            permissions: []
        });
    };

    const togglePermission = (perm: string) => {
        setFormData(prev => {
            if (prev.permissions.includes(perm)) {
                return { ...prev, permissions: prev.permissions.filter(p => p !== perm) };
            } else {
                return { ...prev, permissions: [...prev.permissions, perm] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;

        const url = editingRole.id === 'new' ? '/api/roles' : `/api/roles/${editingRole.id}`;
        const method = editingRole.id === 'new' ? 'POST' : 'PATCH';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setEditingRole(null);
                fetchRoles();
            } else {
                alert('فشل الحفظ');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) return;
        try {
            await fetch(`/api/roles/${id}`, { method: 'DELETE' });
            fetchRoles();
        } catch (error) { console.error(error); }
    };

    const permissionCategories = {
        'المستخدمين': [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ADD, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_DELETE],
        'المنشآت': [PERMISSIONS.FACILITIES_VIEW, PERMISSIONS.FACILITIES_ADD, PERMISSIONS.FACILITIES_EDIT, PERMISSIONS.FACILITIES_DELETE],
        'الطلبات': [
            PERMISSIONS.ORDERS_VIEW,
            PERMISSIONS.ORDERS_ADD,
            PERMISSIONS.ORDERS_EDIT,
            PERMISSIONS.ORDERS_DELETE,
            PERMISSIONS.ORDERS_CHANGE_STATUS,
            PERMISSIONS.ORDERS_VIEW_FINANCIALS
        ],
        'الحركات المالية': [PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_ADD],
        'النظام': [
            PERMISSIONS.ROLES_MANAGE,
            PERMISSIONS.SETTINGS_MANAGE,
            PERMISSIONS.ALERTS_MANAGE,
            PERMISSIONS.BOOKING_MANAGE
        ],
        'حالات الطلب': [
            PERMISSIONS.STATUS_DELIVERING_TO_FACTORY,
            PERMISSIONS.STATUS_PROCESSING,
            PERMISSIONS.STATUS_SHOP_READY,
            PERMISSIONS.STATUS_DELIVERING,
            PERMISSIONS.STATUS_COMPLETED,
            PERMISSIONS.STATUS_REVIEW
        ]
    };

    return (
        <div className="min-h-screen bg-background pb-10">
            <NavBar />

            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold">إدارة الأدوار والصلاحيات</h1>
                    <button onClick={handleCreate} className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90">
                        + دور جديد
                    </button>
                </div>

                {loading ? <p>جاري التحميل...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {roles.map(role => (
                            <div key={role.id} className="bg-white p-6 rounded-xl border shadow-sm">
                                <h3 className="text-lg font-bold mb-1">{role.displayName}</h3>
                                <p className="text-xs text-muted-foreground mb-4 font-mono">{role.name}</p>
                                <div className="text-sm text-gray-600 mb-4">
                                    {role.permissions.length} صلاحية مفعلة
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(role)} className="flex-1 bg-gray-100 text-gray-700 py-1.5 rounded hover:bg-gray-200">تعديل</button>
                                    <button onClick={() => handleDelete(role.id)} className="px-3 bg-red-50 text-red-600 rounded hover:bg-red-100">حذف</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal / Editor Overlay */}
                {editingRole && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b">
                                <h2 className="text-xl font-bold">
                                    {editingRole.id === 'new' ? 'إنشاء دور جديد' : 'تعديل الدور'}
                                </h2>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">الاسم البرمجي (إنجليزي)</label>
                                        <input
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full border p-2 rounded"
                                            dir="ltr"
                                            placeholder="Example: SUPER_ADMIN"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">الاسم الظاهر (عربي)</label>
                                        <input
                                            required
                                            value={formData.displayName}
                                            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                            className="w-full border p-2 rounded"
                                            placeholder="مثال: مدير عام"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold border-b pb-2">تحديد الصلاحيات</h3>
                                    {Object.entries(permissionCategories).map(([category, perms]) => (
                                        <div key={category} className="bg-gray-50 p-4 rounded-lg">
                                            <h4 className="font-medium mb-3 text-primary">{category}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {perms.map(perm => (
                                                    <label key={perm} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.permissions.includes(perm)}
                                                            onChange={() => togglePermission(perm)}
                                                            className="w-4 h-4 rounded text-primary"
                                                        />
                                                        <span className="text-xs font-medium text-gray-700">{PERMISSION_LABELS[perm] || perm}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </form>

                            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                                <button onClick={() => setEditingRole(null)} className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded">إلغاء</button>
                                <button onClick={handleSubmit} className="px-6 py-2 bg-primary text-white rounded hover:bg-primary/90">حفظ التغييرات</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
