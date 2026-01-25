'use client';

import { useState } from 'react';

export default function GrantAdminPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');

    const grantAdmin = async () => {
        if (!confirm('هل أنت متأكد من منح جميع المستخدمين صلاحيات مدير النظام؟')) {
            return;
        }

        setLoading(true);
        setResult('');

        try {
            const res = await fetch('/api/grant-admin', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setResult('✅ نجح!\n\n' + JSON.stringify(data, null, 2));
            } else {
                setResult('❌ خطأ: ' + (data.error || 'فشل التحديث'));
            }
        } catch (error) {
            setResult('❌ خطأ: ' + error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
                <h1 className="text-3xl font-bold text-center mb-2">⚡ منح صلاحيات المدير</h1>
                <p className="text-center text-muted-foreground mb-8">
                    سيتم منح جميع المستخدمين الموجودين دور &quot;مدير النظام&quot; مع كل الصلاحيات
                </p>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                    <h3 className="font-bold mb-2 text-red-700 dark:text-red-400">⚠️ تحذير:</h3>
                    <ul className="text-sm space-y-1">
                        <li>• سيتم منح <strong>جميع المستخدمين</strong> صلاحيات كاملة</li>
                        <li>• يشمل ذلك القدرة على إضافة/تعديل/حذف كل شيء</li>
                        <li>• استخدم هذا فقط للإعداد الأولي أو الطوارئ</li>
                    </ul>
                </div>

                <button
                    onClick={grantAdmin}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? '⏳ جاري التحديث...' : '🔓 منح الصلاحيات للجميع'}
                </button>

                {result && (
                    <div className="mt-6 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 max-h-96 overflow-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{result}</pre>
                    </div>
                )}

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    <p>بعد التحديث، قم بتسجيل الخروج ثم الدخول مرة أخرى</p>
                </div>
            </div>
        </div>
    );
}
