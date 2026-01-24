'use client';

import { useState, useEffect } from 'react';
import NavBar from '../../components/NavBar';
import { Settings, Save, Printer, Palette, Type } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        appName: '',
        logoUrl: '',
        printHeader: '',
        printFooter: '',
        themeColor: '#d97706'
    });
    const router = useRouter();

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                setSettings({
                    appName: data.appName || '',
                    logoUrl: data.logoUrl || '',
                    printHeader: data.printHeader || '',
                    printFooter: data.printFooter || '',
                    themeColor: data.themeColor || '#d97706'
                });
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                alert('تم حفظ الإعدادات بنجاح! سيتم تطبيق التغييرات فوراً.');
                router.refresh(); // To update the navbar if we dynamic it later
            } else {
                alert('فشل حفظ الإعدادات');
            }
        } catch (e) {
            alert('حدث خطأ');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="p-8 text-center">جاري التحميل...</div>;

    return (
        <div className="min-h-screen bg-background">
            <NavBar />

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                        <Settings className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">إعدادات النظام</h1>
                        <p className="text-muted-foreground">تخصيص هوية البرنامج وإعدادات التقارير</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">

                    {/* General Settings */}
                    <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Type className="w-5 h-5 text-primary" />
                            هوية البرنامج
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">اسم البرنامج</label>
                                <input
                                    type="text"
                                    value={settings.appName}
                                    onChange={e => setSettings({ ...settings, appName: e.target.value })}
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2"
                                    placeholder="مثال: نظام سلطان"
                                />
                                <p className="text-xs text-muted-foreground">يظهر في شريط العنوان والشاشة الرئيسية.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">رابط الشعار (Logo URL)</label>
                                <input
                                    type="text"
                                    dir="ltr"
                                    value={settings.logoUrl}
                                    onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2"
                                    placeholder="/logo.png or https://..."
                                />
                                <p className="text-xs text-muted-foreground">رابط صورة الشعار (يفضل أن يكون مربعاً).</p>
                            </div>
                        </div>
                    </section>

                    {/* Theme Settings (Simplified) */}
                    <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Palette className="w-5 h-5 text-primary" />
                            المظهر والألوان
                        </h3>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">لون النظام الرئيسي</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="color"
                                    value={settings.themeColor}
                                    onChange={e => setSettings({ ...settings, themeColor: e.target.value })}
                                    className="h-10 w-20 rounded cursor-pointer"
                                />
                                <span className="text-sm font-mono" dir="ltr">{settings.themeColor}</span>
                            </div>
                        </div>
                    </section>

                    {/* Print Settings */}
                    <section className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Printer className="w-5 h-5 text-primary" />
                            إعدادات الطباعة والتقارير
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">نص رأس الصفحة (Header)</label>
                                <input
                                    type="text"
                                    value={settings.printHeader}
                                    onChange={e => setSettings({ ...settings, printHeader: e.target.value })}
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2"
                                    placeholder="مثال: مؤسسة سلطان التجارية - الرياض"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">نص تذييل الصفحة (Footer)</label>
                                <input
                                    type="text"
                                    value={settings.printFooter}
                                    onChange={e => setSettings({ ...settings, printFooter: e.target.value })}
                                    className="w-full rounded-lg border border-input bg-background px-4 py-2"
                                    placeholder="مثال: العنوان: شارع الملك فهد | هاتف: 05000000"
                                />
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg transition-all disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                        </button>
                    </div>

                </form>
            </main>
        </div>
    );
}
