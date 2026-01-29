'use client';

import { useState, useEffect } from 'react';
import NavBar from '../../components/NavBar';
import { PERMISSIONS, PERMISSION_LABELS } from '../../../lib/permissions';
import {
    Shield,
    Edit3,
    Trash2,
    Plus,
    Search,
    Users,
    ChevronDown,
    ChevronUp,
    Copy,
    Info,
    CheckCircle2,
    Save,
    X,
    LayoutGrid,
    Settings,
    UserPlus,
    CreditCard,
    FileText,
    History,
    RefreshCw
} from 'lucide-react';

interface Role {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    permissions: string[];
    _count?: {
        users: number;
    };
}

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingRole, setEditingRole] = useState<Role | { id: 'new' } | null>(null);
    const [saving, setSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        'المستخدمين': true,
        'الطلبات': true,
        'النظام': true
    });

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        displayName: '',
        description: '',
        permissions: [] as string[]
    });

    useEffect(() => {
        fetchRoles();
    }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
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
            description: role.description || '',
            permissions: role.permissions || []
        });
    };

    const handleDuplicate = (role: Role) => {
        setEditingRole({ id: 'new' });
        setFormData({
            name: `${role.name}_COPY`,
            displayName: `${role.displayName} (نسخة)`,
            description: role.description || '',
            permissions: role.permissions || []
        });
    };

    const handleCreate = () => {
        setEditingRole({ id: 'new' });
        setFormData({
            name: '',
            displayName: '',
            description: '',
            permissions: []
        });
    };

    const togglePermission = (perm: string) => {
        setFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }));
    };

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;

        setSaving(true);
        const isNew = editingRole.id === 'new';
        const url = isNew ? '/api/roles' : `/api/roles/${(editingRole as Role).id}`;
        const method = isNew ? 'POST' : 'PATCH';

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
                const err = await res.json();
                alert(err.error || 'فشل الحفظ');
            }
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء الحفظ');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: Role) => {
        if (role._count && role._count.users > 0) {
            alert(`لا يمكن حذف هذا الدور لأنه مرتبط بـ ${role._count.users} مستخدمين.`);
            return;
        }

        if (!confirm(`هل أنت متأكد من حذف دور "${role.displayName}"؟`)) return;

        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRoles();
            } else {
                alert('فشل الحذف');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const permissionCategories = {
        'المستخدمين': {
            icon: <Users className="w-4 h-4" />,
            perms: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ADD, PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_DELETE]
        },
        'المنشآت': {
            icon: <LayoutGrid className="w-4 h-4" />,
            perms: [PERMISSIONS.FACILITIES_VIEW, PERMISSIONS.FACILITIES_ADD, PERMISSIONS.FACILITIES_EDIT, PERMISSIONS.FACILITIES_DELETE]
        },
        'الطلبات': {
            icon: <FileText className="w-4 h-4" />,
            perms: [
                PERMISSIONS.ORDERS_VIEW,
                PERMISSIONS.ORDERS_ADD,
                PERMISSIONS.ORDERS_EDIT,
                PERMISSIONS.ORDERS_DELETE,
                PERMISSIONS.ORDERS_CHANGE_STATUS,
                PERMISSIONS.ORDERS_VIEW_FINANCIALS
            ]
        },
        'الحركات المالية': {
            icon: <CreditCard className="w-4 h-4" />,
            perms: [PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_ADD]
        },
        'النظام': {
            icon: <Settings className="w-4 h-4" />,
            perms: [
                PERMISSIONS.ROLES_MANAGE,
                PERMISSIONS.SETTINGS_MANAGE,
                PERMISSIONS.ALERTS_MANAGE,
                PERMISSIONS.BOOKING_MANAGE
            ]
        },
        'حالات الطلب': {
            icon: <History className="w-4 h-4" />,
            perms: [
                PERMISSIONS.STATUS_DELIVERING_TO_FACTORY,
                PERMISSIONS.STATUS_PROCESSING,
                PERMISSIONS.STATUS_SHOP_READY,
                PERMISSIONS.STATUS_DELIVERING,
                PERMISSIONS.STATUS_COMPLETED,
                PERMISSIONS.STATUS_REVIEW
            ]
        }
    };

    const filteredRoles = roles.filter(r =>
        r.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">إدارة الأدوار والصلاحيات</h1>
                        <p className="text-gray-500 mt-1">تخصيص مستويات الوصول للموظفين والمستخدمين.</p>
                    </div>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20"
                    >
                        <Plus className="w-5 h-5" />
                        <span>إضافة دور جديد</span>
                    </button>
                </div>

                {/* Global Search */}
                <div className="relative mb-8">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="ابحث عن دور برمجي أو اسم..."
                        className="w-full bg-white border border-gray-200 rounded-2xl p-4 pr-12 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-48 bg-gray-200 rounded-2xl" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRoles.map(role => (
                            <div key={role.id} className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                                        <Shield className="w-6 h-6" />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleDuplicate(role)}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
                                            title="نسخ الدور"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(role)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors"
                                            title="تعديل"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(role)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="حذف"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-gray-900 mb-1">{role.displayName}</h3>
                                <p className="text-xs font-mono text-gray-400 mb-3" dir="ltr">@{role.name}</p>

                                {role.description && (
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                                        {role.description}
                                    </p>
                                )}

                                <div className="flex items-center gap-4 pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                        <span>{role.permissions.length} صلاحية</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                                        <Users className="w-3.5 h-3.5 text-blue-500" />
                                        <span>{role._count?.users || 0} مستخدم</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Editor Modal */}
                {editingRole && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Modal Header */}
                            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        {editingRole.id === 'new' ? <UserPlus className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {editingRole.id === 'new' ? 'إنشاء دور جديد' : `تعديل دور: ${formData.displayName}`}
                                        </h2>
                                        <p className="text-xs text-gray-500">قم بتخصيص المعلومات والصلاحيات بدقة.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingRole(null)}
                                    className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            الاسم البرمجي <Info className="w-3.5 h-3.5 text-gray-400" />
                                        </label>
                                        <input
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                            className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all font-mono"
                                            dir="ltr"
                                            placeholder="MANAGER_SALES"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">الاسم الظاهر</label>
                                        <input
                                            required
                                            value={formData.displayName}
                                            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            placeholder="مثال: مدير مبيعات"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-sm font-bold text-gray-700">وصف الدور</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[80px]"
                                            placeholder="اشرح الغرض من هذا الدور والصلاحيات الممنوحة له..."
                                        />
                                    </div>
                                </div>

                                {/* Permissions Grid */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b pb-4">
                                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                            مصفوفة الصلاحيات
                                            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                {formData.permissions.length} مختار
                                            </span>
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, permissions: Object.values(PERMISSIONS) })}
                                                className="text-xs text-primary hover:underline"
                                            >اختيار الكل</button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, permissions: [] })}
                                                className="text-xs text-red-500 hover:underline"
                                            >إلغاء الكل</button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {Object.entries(permissionCategories).map(([category, { icon, perms }]) => (
                                            <div key={category} className="border border-gray-100 rounded-2xl overflow-hidden">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCategory(category)}
                                                    className="w-full flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-primary">{icon}</div>
                                                        <span className="font-bold text-gray-800">{category}</span>
                                                    </div>
                                                    {expandedCategories[category] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                </button>

                                                {expandedCategories[category] && (
                                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white">
                                                        {perms.map(perm => {
                                                            const isSelected = formData.permissions.includes(perm);
                                                            return (
                                                                <label
                                                                    key={perm}
                                                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                                                                            ? 'bg-primary/5 border-primary shadow-sm'
                                                                            : 'bg-white border-gray-100 hover:border-gray-300'
                                                                        }`}
                                                                >
                                                                    <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-gray-600'}`}>
                                                                        {PERMISSION_LABELS[perm] || perm}
                                                                    </span>
                                                                    <div
                                                                        className={`w-10 h-5 rounded-full relative transition-colors ${isSelected ? 'bg-primary' : 'bg-gray-200'}`}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            togglePermission(perm);
                                                                        }}
                                                                    >
                                                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isSelected ? 'right-6' : 'right-1'}`} />
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </form>

                            {/* Modal Footer */}
                            <div className="p-6 border-t bg-gray-50 flex justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingRole(null)}
                                    className="px-6 py-2.5 text-gray-600 hover:bg-gray-200 rounded-xl transition-colors font-bold"
                                >
                                    إلغاء
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={handleSubmit}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>{saving ? 'جاري الحفظ...' : 'حفظ الدور'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
