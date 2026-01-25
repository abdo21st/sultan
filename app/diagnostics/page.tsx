'use client';

import { useEffect, useState } from 'react';

export default function DiagnosticPage() {
    const [info, setInfo] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDiagnostics() {
            try {
                const res = await fetch('/api/diagnostics');
                const data = await res.json();
                setInfo(data);
            } catch (error) {
                setInfo({ error: String(error) });
            } finally {
                setLoading(false);
            }
        }
        fetchDiagnostics();
    }, []);

    if (loading) return <div className="p-8">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-6">🔍 تشخيص النظام</h1>

                <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 shadow-lg">
                    <pre className="text-xs overflow-auto" dir="ltr">
                        {JSON.stringify(info, null, 2)}
                    </pre>
                </div>

                <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <h3 className="font-bold mb-2">📋 التعليمات:</h3>
                    <ul className="text-sm space-y-1">
                        <li>✅ تحقق من عدد المستخدمين والأدوار</li>
                        <li>✅ تحقق من الصلاحيات الحالية للمستخدم</li>
                        <li>✅ إذا كانت البيانات فارغة، اذهب إلى /setup</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
