'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Plus, Trash2, Edit, User as UserIcon, Users, Shield,
    Search, ChevronDown, ChevronUp, Copy, Info,
    CheckCircle2, Save, X, LayoutGrid, Settings,
    UserPlus, CreditCard, FileText, History, RefreshCw
} from 'lucide-react';
import NavBar from '../../components/NavBar';
import { useToast } from '@/app/components/ToastProvider';
import { usePermission } from '../../../lib/usePermission';
import { PERMISSIONS, PERMISSION_LABELS } from '../../../lib/permissions';

interface User {
    id: string;
    username: string;
    displayName: string;
    role: string;
    roles?: { id: string, name: string, displayName: string }[];
    createdAt: string;
}

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

export default function AccessManagementPage() {
    const { showToast } = useToast();
    const { hasPermission } = usePermission();
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

    // Users State
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);

    // Roles State
    const [roles, setRoles] = useState<Role[]>([]);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [editingRole, setEditingRole] = useState<Role | { id: 'new' } | null>(null);
    const [savingRole, setSavingRole] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        'المستخدمين': true,
        'الطلبات': true,
        'النظام': true
    });

    const [roleFormData, setRoleFormData] = useState({
        name: '',
        displayName: '',
        description: '',
        permissions: [] as string[]
    });

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, []);

    // --- Users Logic ---
    async function fetchUsers() {
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        } finally {
            setUsersLoading(false);
        }
    }

    async function handleUserDelete(id: string) {
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== id));
                showToast('تم حذف المستخدم بنجاح', 'success');
            } else {
                showToast('فشل حذف المستخدم', 'error');
            }
        } catch (error) {
            console.error('Failed to delete user', error);
        }
    }

    // --- Roles Logic ---
    const fetchRoles = async () => {
        try {
            setRolesLoading(true);
            const res = await fetch('/api/roles');
            const data = await res.json();
            if (Array.isArray(data)) setRoles(data);
        } catch (error) {
            console.error(error);
        } finally {
            setRolesLoading(false);
        }
    };

    const handleRoleEdit = (role: Role) => {
        setEditingRole(role);
        setRoleFormData({
            name: role.name,
            displayName: role.displayName,
            description: role.description || '',
            permissions: role.permissions || []
        });
    };

    const handleRoleDuplicate = (role: Role) => {
        setEditingRole({ id: 'new' });
        setRoleFormData({
            name: `${role.name}_COPY`,
            displayName: `${role.displayName} (نسخة)`,
            description: role.description || '',
            permissions: role.permissions || []
        });
    };

    const handleRoleCreate = () => {
        setEditingRole({ id: 'new' });
        setRoleFormData({
            name: '',
            displayName: '',
            description: '',
            permissions: []
        });
    };

    const togglePermission = (perm: string) => {
        setRoleFormData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }));
    };

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const handleRoleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRole) return;
        setSavingRole(true);
        const isNew = editingRole.id === 'new';
        const url = isNew ? '/api/roles' : `/api/roles/${(editingRole as Role).id}`;
        const method = isNew ? 'POST' : 'PATCH';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(roleFormData)
            });

            if (res.ok) {
                setEditingRole(null);
                fetchRoles();
                showToast('تم حفظ الدور بنجاح', 'success');
            } else {
                const err = await res.json();
                showToast(err.error || 'فشل الحفظ', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('حدث خطأ أثناء الحفظ', 'error');
        } finally {
            setSavingRole(false);
        }
    };

    const handleRoleDelete = async (role: Role) => {
        if (role._count && role._count.users > 0) {
            showToast(`لا يمكن حذف هذا الدور لأنه مرتبط بـ ${role._count.users} مستخدمين.`, 'error');
            return;
        }

        if (!confirm(`هل أنت متأكد من حذف دور "${role.displayName}"؟`)) return;

        try {
            const res = await fetch(`/api/roles/${role.id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchRoles();
                showToast('تم حذف الدور بنجاح', 'success');
            } else {
                showToast('فشل الحذف', 'error');
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
        'مشاهدة الحالات': {
            icon: <History className="w-4 h-4" />,
            perms: [
                PERMISSIONS.STATUS_VIEW_REGISTERED,
                PERMISSIONS.STATUS_VIEW_REVIEW,
                PERMISSIONS.STATUS_VIEW_PROCESSING,
                PERMISSIONS.STATUS_VIEW_DELIVERING_TO_FACTORY,
                PERMISSIONS.STATUS_VIEW_SHOP_READY,
                PERMISSIONS.STATUS_VIEW_DELIVERING,
                PERMISSIONS.STATUS_VIEW_COMPLETED
            ]
        },
        'تغيير الحالات': {
            icon: <RefreshCw className="w-4 h-4" />,
            perms: [
                PERMISSIONS.STATUS_CHANGE_REGISTERED,
                PERMISSIONS.STATUS_CHANGE_REVIEW,
                PERMISSIONS.STATUS_CHANGE_PROCESSING,
                PERMISSIONS.STATUS_CHANGE_DELIVERING_TO_FACTORY,
                PERMISSIONS.STATUS_CHANGE_SHOP_READY,
                PERMISSIONS.STATUS_CHANGE_DELIVERING,
                PERMISSIONS.STATUS_CHANGE_COMPLETED
            ]
        }
    };

    const filteredRoles = roles.filter(r =>
        r.displayName.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
        r.name.toLowerCase().includes(roleSearchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background">
            <NavBar />

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-foreground tracking-tight">إدارة <span className="text-gradient-gold">النظام</span></h1>
                        <p className="text-muted-foreground font-semibold">التحكم في المستخدمين، الأدوار، وصلاحيات الوصول.</p>
                    </div>

                    <div className="flex bg-muted/50 p-1 rounded-2xl border border-border/50 backdrop-blur-sm">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-8 py-3 rounded-xl font-black text-sm transition-all duration-300 ${activeTab === 'users' ? 'bg-background text-primary shadow-lg border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <div className="flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                <span>المستخدمين</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`px-8 py-3 rounded-xl font-black text-sm transition-all duration-300 ${activeTab === 'roles' ? 'bg-background text-primary shadow-lg border border-border' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                <span>الأدوار</span>
                            </div>
                        </button>
                    </div>
                </div>

                {activeTab === 'users' ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-card/50 backdrop-blur-md p-6 rounded-3xl border border-border/50 shadow-xl shadow-black/5">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                    <UserIcon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">قائمة الموظفين</h2>
                                    <p className="text-sm text-muted-foreground">إدارة الحسابات النشطة في النظام</p>
                                </div>
                            </div>
                            {hasPermission(PERMISSIONS.USERS_ADD) && (
                                <Link
                                    href="/admin/users/new"
                                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-primary to-amber-800 text-white rounded-2xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 font-black text-sm uppercase tracking-widest gold-glow transform hover:-translate-y-0.5"
                                >
                                    <Plus className="w-5 h-5" strokeWidth={3} />
                                    <span>مستخدم جديد</span>
                                </Link>
                            )}
                        </div>

                        <div className="bg-card/50 backdrop-blur-md rounded-3xl border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
                            {usersLoading ? (
                                <div className="p-20 text-center text-muted-foreground font-bold animate-pulse">جاري تحميل المستخدمين...</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right">
                                        <thead>
                                            <tr className="bg-muted/30 text-muted-foreground border-b border-border/50">
                                                <th className="p-6 font-black uppercase tracking-wider">الموظف</th>
                                                <th className="p-6 font-black uppercase tracking-wider">الأدوار الوظيفية</th>
                                                <th className="p-6 font-black uppercase tracking-wider">تاريخ الانضمام</th>
                                                <th className="p-6 font-black uppercase tracking-wider text-left">التحكم</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {users.map((user) => (
                                                <tr key={user.id} className="hover:bg-muted/20 transition-all group">
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                                <UserIcon className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-foreground text-base">{user.displayName}</p>
                                                                <p className="text-xs text-muted-foreground font-mono" dir="ltr">@{user.username}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6">
                                                        <div className="flex flex-wrap gap-2">
                                                            {user.roles && user.roles.length > 0 ? (
                                                                user.roles.map((r) => (
                                                                    <span key={r.id} className="px-3 py-1 bg-primary/5 text-primary rounded-xl text-[10px] font-black border border-primary/20 uppercase tracking-tighter">
                                                                        {r.displayName}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="px-3 py-1 bg-muted text-muted-foreground rounded-xl text-[10px] font-black border border-border uppercase">
                                                                    {user.role}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-muted-foreground font-semibold" dir="ltr">
                                                        {new Date(user.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-6 text-left">
                                                        <div className="flex justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                                            <Link href={`/admin/users/${user.id}/edit`} className="p-3 text-blue-500 hover:bg-blue-500/10 rounded-2xl transition-colors border border-transparent hover:border-blue-500/20" title="تعديل">
                                                                <Edit className="w-5 h-5" />
                                                            </Link>
                                                            <button onClick={() => handleUserDelete(user.id)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-2xl transition-colors border border-transparent hover:border-red-500/20" title="حذف">
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Roles Search and Add */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="ابحث عن دور أو مسمى وظيفي..."
                                    className="w-full bg-card/50 backdrop-blur-md border border-border/50 rounded-2xl p-4 pr-12 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-xl shadow-black/5"
                                    value={roleSearchTerm}
                                    onChange={e => setRoleSearchTerm(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleRoleCreate}
                                className="flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-br from-primary to-amber-800 text-white rounded-2xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 font-black text-sm uppercase tracking-widest gold-glow transform hover:-translate-y-0.5"
                            >
                                <Plus className="w-5 h-5" />
                                <span>إضافة دور جديد</span>
                            </button>
                        </div>

                        {rolesLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                                {[1, 2, 3].map(i => <div key={i} className="h-48 bg-card/50 rounded-3xl border border-border/50" />)}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredRoles.map(role => (
                                    <div key={role.id} className="group bg-card/50 backdrop-blur-md p-8 rounded-3xl border border-border/50 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-primary/10 transition-all relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-1.5 h-full bg-primary opacity-0 group-hover:opacity-100 transition-all" />

                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Shield className="w-7 h-7" />
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => handleRoleDuplicate(role)} className="p-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all" title="نسخ الدور">
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleRoleEdit(role)} className="p-3 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all" title="تعديل">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleRoleDelete(role)} className="p-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="حذف">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <h3 className="text-2xl font-black text-foreground mb-1 group-hover:text-primary transition-colors">{role.displayName}</h3>
                                        <p className="text-xs font-mono text-muted-foreground/60 mb-4" dir="ltr">@{role.name}</p>

                                        {role.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10 font-semibold leading-relaxed">
                                                {role.description}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-6 pt-6 border-t border-border/30">
                                            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground">
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                <span>{role.permissions.length} صلاحية</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground">
                                                <Users className="w-4 h-4 text-primary" />
                                                <span>{role._count?.users || 0} مستخدم</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Editor Modal for Roles */}
                {editingRole && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-card rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
                            <div className="p-8 border-b border-border/50 flex justify-between items-center bg-muted/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                                        {editingRole.id === 'new' ? <UserPlus className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-foreground">
                                            {editingRole.id === 'new' ? 'إنشاء دور جديد' : `تعديل دور: ${roleFormData.displayName}`}
                                        </h2>
                                        <p className="text-xs text-muted-foreground font-semibold">قم بتخصيص المعلومات والصلاحيات بدقة عالية.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEditingRole(null)}
                                    title="إغلاق النافذة"
                                    aria-label="إغلاق النافذة"
                                    className="p-3 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all text-muted-foreground border border-transparent hover:border-red-500/20"
                                >
                                    <X className="w-7 h-7" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={handleRoleSubmit} className="flex-1 overflow-y-auto p-10 space-y-10">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-sm font-black text-foreground flex items-center gap-2">
                                            الاسم البرمجي <Info className="w-4 h-4 text-primary" />
                                        </label>
                                        <input
                                            required
                                            value={roleFormData.name}
                                            onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value.toUpperCase().replace(/\s/g, '_') })}
                                            className="w-full bg-muted/50 border border-border p-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono"
                                            dir="ltr"
                                            placeholder="MANAGER_SALES"
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-sm font-black text-foreground">الاسم الظاهر</label>
                                        <input
                                            required
                                            value={roleFormData.displayName}
                                            onChange={e => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                                            className="w-full bg-muted/50 border border-border p-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                                            placeholder="مثال: مدير مبيعات"
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-3">
                                        <label className="text-sm font-black text-foreground">وصف الدور</label>
                                        <textarea
                                            value={roleFormData.description}
                                            onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                            className="w-full bg-muted/50 border border-border p-4 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all min-h-[100px] resize-none"
                                            placeholder="اشرح الغرض من هذا الدور والصلاحيات الممنوحة له بوضوح..."
                                        />
                                    </div>
                                </div>

                                {/* Permissions Grid */}
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between border-b border-border pb-6">
                                        <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                                            مصفوفة الصلاحيات
                                            <span className="text-[10px] font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                                {roleFormData.permissions.length} عنصر مختار
                                            </span>
                                        </h3>
                                        <div className="flex gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setRoleFormData({ ...roleFormData, permissions: Object.values(PERMISSIONS) })}
                                                className="text-xs font-black text-primary hover:underline underline-offset-4"
                                            >اختيار الكل</button>
                                            <div className="w-1 h-1 bg-border rounded-full" />
                                            <button
                                                type="button"
                                                onClick={() => setRoleFormData({ ...roleFormData, permissions: [] })}
                                                className="text-xs font-black text-red-500 hover:underline underline-offset-4"
                                            >إلغاء الكل</button>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {Object.entries(permissionCategories).map(([category, { icon, perms }]) => (
                                            <div key={category} className="border border-border/50 rounded-[1.5rem] overflow-hidden bg-muted/20">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCategory(category)}
                                                    className="w-full flex items-center justify-between p-6 hover:bg-muted/40 transition-all font-black"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-2 bg-background border border-border rounded-xl text-primary shadow-sm">{icon}</div>
                                                        <span className="text-foreground">{category}</span>
                                                    </div>
                                                    {expandedCategories[category] ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                                </button>

                                                {expandedCategories[category] && (
                                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-border/30 bg-background/50">
                                                        {perms.map(perm => {
                                                            const isSelected = roleFormData.permissions.includes(perm);
                                                            return (
                                                                <label
                                                                    key={perm}
                                                                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group/label ${isSelected
                                                                        ? 'bg-primary/5 border-primary/40 shadow-inner'
                                                                        : 'bg-background border-border hover:border-primary/30'
                                                                        }`}
                                                                >
                                                                    <span className={`text-xs font-black transition-colors ${isSelected ? 'text-primary' : 'text-muted-foreground group-hover/label:text-foreground'}`}>
                                                                        {PERMISSION_LABELS[perm] || perm}
                                                                    </span>
                                                                    <div
                                                                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isSelected ? 'bg-primary gold-glow' : 'bg-muted'}`}
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            togglePermission(perm);
                                                                        }}
                                                                    >
                                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300 ${isSelected ? 'right-7' : 'right-1'}`} />
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
                            <div className="p-8 border-t border-border/50 bg-muted/30 flex justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingRole(null)}
                                    className="px-8 py-4 text-muted-foreground hover:bg-muted border border-border/50 rounded-2xl transition-all font-black text-sm"
                                >
                                    إلغاء التعديلات
                                </button>
                                <button
                                    type="button"
                                    disabled={savingRole}
                                    onClick={handleRoleSubmit}
                                    className="flex items-center gap-3 px-10 py-4 bg-gradient-to-br from-primary to-amber-800 text-white rounded-2xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 font-black text-sm uppercase tracking-widest gold-glow transform hover:-translate-y-0.5 disabled:opacity-50"
                                >
                                    {savingRole ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                    <span>{savingRole ? 'جاري الحفظ...' : 'حفظ الدور بالكامل'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
