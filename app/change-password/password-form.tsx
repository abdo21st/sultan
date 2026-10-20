'use client';

import { useState, type FormEvent } from 'react';
import { signOut } from 'next-auth/react';
import { LockKeyhole, Loader2 } from 'lucide-react';

export default function ChangePasswordForm() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        if (newPassword !== confirmation) return setError('كلمتا المرور الجديدتان غير متطابقتين');
        setBusy(true);
        try {
            const response = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'تعذر تغيير كلمة المرور');
            await signOut({ callbackUrl: '/login?passwordChanged=1' });
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'تعذر الاتصال بالخادم');
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-background flex items-center justify-center p-6">
            <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 space-y-6">
                <LockKeyhole className="h-8 w-8 text-primary" aria-hidden="true" />
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">غيّر كلمة المرور الأولية</h1>
                    <p className="text-sm text-muted-foreground">اختر كلمة مرور خاصة بك من 12 حرفاً على الأقل للمتابعة. بعد حفظها ستسجّل الدخول بالكلمة الجديدة.</p>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    <label className="block space-y-2">
                        <span>كلمة المرور الحالية</span>
                        <input autoComplete="current-password" type="password" required maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-3" />
                    </label>
                    <label className="block space-y-2">
                        <span>كلمة المرور الجديدة</span>
                        <input autoComplete="new-password" type="password" required minLength={12} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-3" />
                    </label>
                    <label className="block space-y-2">
                        <span>تأكيد كلمة المرور الجديدة</span>
                        <input autoComplete="new-password" type="password" required minLength={12} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-3" />
                    </label>
                    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                    <button disabled={busy} className="w-full rounded-lg bg-primary p-3 font-bold text-primary-foreground disabled:opacity-60 flex justify-center items-center gap-2">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ كلمة المرور
                    </button>
                </form>
                <button type="button" disabled={busy} onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-muted-foreground underline">تسجيل الخروج</button>
            </section>
        </main>
    );
}
