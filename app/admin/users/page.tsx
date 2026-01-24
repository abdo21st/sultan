'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Edit, User as UserIcon } from 'lucide-react';

interface User {
    id: string;
    username: string;
    displayName: string;
    role: string;
    createdAt: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

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
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setUsers(users.filter(u => u.id !== id));
            } else {
                alert('فشل الحذف');
            }
        } catch (error) {
            console.error('Failed to delete user', error);
        }
    }

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex justify-between items-center bg-card p-6 rounded-xl border border-border shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
                        <p className="text-muted-foreground">صلاحيات وأدوار الموظفين</p>
                    </div>
                    <Link href="/admin/users/new" className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-amber-600 transition-colors">
                        <Plus className="w-4 h-4" />
                        <span>مستخدم جديد</span>
                    </Link>
                </div>

                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-muted text-muted-foreground">
                            <tr>
                                <th className="p-4 font-medium">المستخدم</th>
                                <th className="p-4 font-medium">الدور (Role)</th>
                                <th className="p-4 font-medium">تاريخ التسجيل</th>
                                <th className="p-4 font-medium text-left">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <UserIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground">{user.displayName}</p>
                                                <p className="text-xs text-muted-foreground" dir="ltr">@{user.username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                      ${user.role === 'ADMIN' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                user.role === 'MANAGER' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                    user.role === 'ACCOUNTANT' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'}
                    `}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-muted-foreground" dir="ltr">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-left">
                                        <div className="flex justify-end gap-2">
                                            <button className="p-2 text-muted-foreground hover:text-primary transition-colors">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(user.id)} className="p-2 text-muted-foreground hover:text-red-600 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
