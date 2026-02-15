'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '../components/NavBar';
import { User, Shield, LogOut, Save, Lock, Loader2, Eye, EyeOff } from 'lucide-react'; // Removed unused Phone
import { type User as NextAuthUser } from "next-auth";
import toast, { Toaster } from 'react-hot-toast';

export default function ProfilePage() {
    const [user, setUser] = useState<NextAuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Edit States
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [infoForm, setInfoForm] = useState({
        displayName: '',
        phoneNumber: '',
    });
    const [isSavingInfo, setIsSavingInfo] = useState(false);

    // Password States
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUser(data.user);
                    setInfoForm({
                        displayName: data.user.displayName || data.user.name || '',
                        phoneNumber: data.user.phoneNumber || '',
                    });
                } else {
                    router.push('/login');
                }
            })
            .catch(() => router.push('/login'))
            .finally(() => setLoading(false));
    }, [router]);

    const handleUpdateInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting Info Form:", infoForm); // DEBUG LOG
        setIsSavingInfo(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(infoForm),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'فشل التحديث');

            setUser(prev => prev ? { ...prev, ...data } : null);
            setIsEditingInfo(false);
            toast.success('تم تحديث المعلومات بنجاح');
            router.refresh();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "حدث خطأ";
            toast.error(message);
        } finally {
            setIsSavingInfo(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('كلمات المرور غير متطابقة');
            return;
        }
        if (passwordForm.newPassword.length < 6) {
            toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }

        setIsChangingPassword(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'فشل تغيير كلمة المرور');

            toast.success('تم تغيير كلمة المرور بنجاح');
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "حدث خطأ";
            toast.error(message);
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background pb-20 md:pb-8">
            <Toaster position="top-center" />
            <NavBar />

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    {/* Header Background */}
                    <div className="h-32 bg-gradient-to-r from-primary/20 to-amber-500/20"></div>

                    <div className="px-6 sm:px-8 pb-8">
                        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-end -mt-12 mb-8 gap-4">
                            <div className="flex items-end gap-6">
                                <div className="w-24 h-24 rounded-full bg-background p-1 shadow-lg shrink-0">
                                    <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="w-10 h-10" />
                                    </div>
                                </div>
                                <div className="mb-1">
                                    <h1 className="text-2xl font-bold text-foreground">{user.displayName || user.name}</h1>
                                    <p className="text-muted-foreground" dir="ltr">@{user.username || user.email}</p>
                                </div>
                            </div>
                            <span className="px-4 py-1.5 rounded-full text-sm font-bold border bg-primary/10 text-primary border-primary/20 self-start sm:self-auto mt-4 sm:mt-0">
                                {user.role === 'ADMIN' ? 'مدير النظام' :
                                    user.role === 'MANAGER' ? 'مدير' :
                                        user.role === 'ACCOUNTANT' ? 'محاسب' :
                                            user.role}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Personal Information Section */}
                            <div className="space-y-6">
                                <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                            <User className="w-5 h-5 text-primary" />
                                            المعلومات الشخصية
                                        </h3>
                                        {!isEditingInfo && (
                                            <button
                                                onClick={() => setIsEditingInfo(true)}
                                                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                                            >
                                                تعديل
                                            </button>
                                        )}
                                    </div>

                                    {isEditingInfo ? (
                                        <form onSubmit={handleUpdateInfo} className="space-y-4">
                                            <div>
                                                <label htmlFor="displayName" className="block text-sm font-medium text-muted-foreground mb-1">الاسم الظاهر</label>
                                                <input
                                                    id="displayName"
                                                    name="displayName"
                                                    title="الاسم الظاهر"
                                                    placeholder="الاسم الظاهر"
                                                    type="text"
                                                    value={infoForm.displayName}
                                                    onChange={e => setInfoForm({ ...infoForm, displayName: e.target.value })}
                                                    className="w-full p-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="phoneNumber" className="block text-sm font-medium text-muted-foreground mb-1">رقم الهاتف (اختياري)</label>
                                                <input
                                                    id="phoneNumber"
                                                    name="phoneNumber"
                                                    title="رقم الهاتف"
                                                    placeholder="05xxxxxxxx"
                                                    type="text"
                                                    value={infoForm.phoneNumber}
                                                    onChange={e => setInfoForm({ ...infoForm, phoneNumber: e.target.value })}
                                                    className="w-full p-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <button
                                                    type="submit"
                                                    disabled={isSavingInfo}
                                                    className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    {isSavingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    حفظ
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsEditingInfo(false)}
                                                    className="flex-1 bg-muted text-muted-foreground py-2 rounded-lg font-bold hover:bg-muted/80 transition-colors"
                                                >
                                                    إلغاء
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                                <span className="text-sm text-muted-foreground">الاسم</span>
                                                <span className="font-semibold">{user.displayName || user.name}</span>
                                            </div>
                                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                                <span className="text-sm text-muted-foreground">رقم الهاتف</span>
                                                <span className="font-semibold" dir="ltr">{(user as any).phoneNumber || '-'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Security Section */}
                            <div className="space-y-6">
                                <div className="bg-card rounded-xl border border-border/50 shadow-sm p-6">
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
                                        <Lock className="w-5 h-5 text-primary" />
                                        الأمان وكلمة المرور
                                    </h3>

                                    <form onSubmit={handleChangePassword} className="space-y-4">
                                        <div>
                                            <label htmlFor="currentPassword" className="block text-sm font-medium text-muted-foreground mb-1">كلمة المرور الحالية</label>
                                            <div className="relative">
                                                <input
                                                    id="currentPassword"
                                                    name="currentPassword"
                                                    title="كلمة المرور الحالية"
                                                    placeholder="كلمة المرور الحالية"
                                                    type={showPassword ? "text" : "password"}
                                                    value={passwordForm.currentPassword}
                                                    onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                                    className="w-full p-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="newPassword" className="block text-sm font-medium text-muted-foreground mb-1">كلمة المرور الجديدة</label>
                                                <input
                                                    id="newPassword"
                                                    name="newPassword"
                                                    title="كلمة المرور الجديدة"
                                                    placeholder="كلمة المرور الجديدة"
                                                    type="password"
                                                    value={passwordForm.newPassword}
                                                    onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                                    className="w-full p-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground mb-1">تأكيد الكلمة</label>
                                                <input
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    title="تأكيد كلمة المرور"
                                                    placeholder="تأكيد كلمة المرور"
                                                    type="password"
                                                    value={passwordForm.confirmPassword}
                                                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                                    className="w-full p-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
                                            className="w-full bg-slate-800 text-white py-2 rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isChangingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                            تحديث كلمة المرور
                                        </button>
                                    </form>
                                </div>

                                <div className="pt-4 border-t border-border">
                                    <button
                                        onClick={() => window.location.href = '/api/auth/signout'}
                                        className="w-full flex items-center justify-between p-4 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 transition-colors group"
                                    >
                                        <span className="font-bold">تسجيل الخروج</span>
                                        <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
