'use client';

import { useState } from 'react';

export default function SetupPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');

    const runSetup = async () => {
        setLoading(true);
        setResult('');

        try {
            const res = await fetch('/api/setup', { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                setResult('✅ تم إنشاء المستخدمين والأدوار بنجاح!\n\n' + JSON.stringify(data, null, 2));
            } else {
                setResult('❌ خطأ: ' + (data.error || 'فشل الإعداد'));
            }
        } catch (error) {
            setResult('❌ خطأ في الاتصال: ' + error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-800 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
                <h1 className="text-3xl font-bold text-center mb-2">🚀 إعداد النظام الأولي</h1>
                <p className="text-center text-muted-foreground mb-8">
                    سيتم إنشاء المستخدمين والأدوار التجريبية
                </p>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                    <h3 className="font-bold mb-2">📋 سيتم إنشاء:</h3>
                    <ul className="text-sm space-y-1">
                        <li>✅ 4 أدوار: مدير النظام، محاسب، موظف استقبال، مدير</li>
                        <li>✅ 4 مستخدمين تجريبيين بصلاحيات مختلفة</li>
                    </ul>
                </div>

                <button
                    onClick={runSetup}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-primary to-amber-500 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? '⏳ جاري الإعداد...' : '▶️ بدء الإعداد'}
                </button>

                {result && (
                    <div className="mt-6 bg-zinc-100 dark:bg-zinc-900 rounded-lg p-4 max-h-96 overflow-auto">
                        <pre className="text-xs whitespace-pre-wrap font-mono">{result}</pre>
                    </div>
                )}

                <div className="mt-6 text-center text-sm text-muted-foreground">
                    <p>بعد الإعداد، يمكنك تسجيل الدخول بـ:</p>
                    <p className="font-mono mt-2">admin / admin123</p>
                </div>
            </div>
        </div>
    );
}
