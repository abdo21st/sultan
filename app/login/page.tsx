'use client';

import { useActionState } from 'react'; // Note: React 19/Next 15 feature, or use useState
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setIsPending(true);

        const formData = new FormData(event.currentTarget);
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;

        try {
            // We need to call signIn via server action or API
            // Since we are client side, the easiest standard way with next-auth v5 
            // is often using the signIn from next-auth/react, but let's try a simple fetch 
            // to avoid complex client setups first or use the server action approach if enabled.
            // Actually, for Credentials, standard signIn('credentials') is best.

            // Dynamic import to avoid SSR issues if not set up
            const { signIn } = await import('next-auth/react');

            const result = await signIn('credentials', {
                username,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError("اسم المستخدم أو كلمة المرور غير صحيحة");
                setIsPending(false);
            } else {
                router.refresh(); // Update auth state
                router.push('/');
            }
        } catch (e) {
            setError("حدث خطأ غير متوقع");
            setIsPending(false);
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="w-full max-w-md p-8 bg-card border border-border rounded-xl shadow-lg">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
                        سلطان
                    </h1>
                    <p className="text-muted-foreground mt-2">تسجيل الدخول للنظام</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            اسم المستخدم
                        </label>
                        <input
                            name="username"
                            type="text"
                            required
                            disabled={isPending}
                            dir="ltr"
                            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                            placeholder="admin"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            كلمة المرور
                        </label>
                        <input
                            name="password"
                            type="password"
                            required
                            disabled={isPending}
                            dir="ltr"
                            className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-3 px-4 bg-primary hover:bg-amber-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-primary/20"
                    >
                        {isPending ? 'جاري التحقق...' : 'دخول'}
                    </button>
                </form>
            </div>
        </div>
    );
}
