'use client';

import { useState, useEffect } from 'react';
import NavBar from '@/app/components/NavBar';
import { Save, Download, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'general' | 'actions'>('general');
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        appName: '',
        logoUrl: '',
        printHeader: '',
        printFooter: '',
        themeColor: '#d97706'
    });

    // Fetch initial settings
    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setSettings({
                        appName: data.appName || '',
                        logoUrl: data.logoUrl || '',
                        printHeader: data.printHeader || '',
                        printFooter: data.printFooter || '',
                        themeColor: data.themeColor || '#d97706'
                    });
                }
            });
    }, []);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) alert('تم حفظ الإعدادات بنجاح');
            else alert('حدث خطأ أثناء الحفظ');
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleBackup = () => {
        window.open('/api/settings/backup', '_blank');
    };

    const handleClearData = async () => {
        if (!confirm('تحذير: سيتم حذف جميع الطلبات والحركات المالية والإشعارات. هل أنت متأكد؟')) return;

        setLoading(true);
        try {
            const res = await fetch('/api/settings/clear-data', { method: 'POST' });
            const data = await res.json();
            if (res.ok) alert(data.message);
            else alert(data.error || 'حدث خطأ');
        } catch {
            alert('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    const handleFactoryReset = async () => {
        const confirmMsg = "تحذير خطير: سيتم حذف جميع البيانات بما في ذلك الطلبات، المستخدمين، والأدوار والعودة لحالة المصنع.\n\nهل أنت متأكد تماماً؟";
        if (!confirm(confirmMsg)) return;
        if (!confirm("تأكيد أخير: هل أنت متأكد؟ العملية لا يمكن التراجع عنها.")) return;

        setLoading(true);
        try {
            const res = await fetch('/api/settings/factory-reset', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                window.location.href = '/login';
            } else {
                alert(data.error || 'حدث خطأ');
            }
        } catch {
            alert('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50 pb-10">
            <NavBar />

            <div className="max-w-4xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-6">إعدادات النظام</h1>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
                    >
                        الإعدادات العامة
                    </button>
                    <button
                        onClick={() => setActiveTab('actions')}
                        className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'actions' ? 'border-red-500 text-red-600' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
                    >
                        إجراءات النظام والبيانات
                    </button>
                </div>

                {activeTab === 'general' ? (
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">اسم التطبيق</label>
                                    <input
                                        value={settings.appName}
                                        onChange={e => setSettings({ ...settings, appName: e.target.value })}
                                        className="w-full border p-2 rounded-lg"
                                        placeholder="سلطان"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">لون الثيم (Hex)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={settings.themeColor}
                                            onChange={e => setSettings({ ...settings, themeColor: e.target.value })}
                                            className="h-10 w-20 p-1 rounded border cursor-pointer"
                                            aria-label="لون النظام"
                                        />
                                        <input
                                            value={settings.themeColor}
                                            onChange={e => setSettings({ ...settings, themeColor: e.target.value })}
                                            className="flex-1 border p-2 rounded-lg text-left"
                                            dir="ltr"
                                            aria-label="كود اللون"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">رابط الشعار (URL)</label>
                                <input
                                    value={settings.logoUrl}
                                    onChange={e => setSettings({ ...settings, logoUrl: e.target.value })}
                                    className="w-full border p-2 rounded-lg text-left"
                                    dir="ltr"
                                    placeholder="https://example.com/logo.png"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">رأس الفاتورة (طباعة)</label>
                                    <textarea
                                        value={settings.printHeader}
                                        onChange={e => setSettings({ ...settings, printHeader: e.target.value })}
                                        className="w-full border p-2 rounded-lg h-24"
                                        placeholder="اسم الشركة، العنوان، الهاتف..."
                                        aria-label="رأس الفاتورة"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">تذييل الفاتورة (طباعة)</label>
                                    <textarea
                                        value={settings.printFooter}
                                        onChange={e => setSettings({ ...settings, printFooter: e.target.value })}
                                        className="w-full border p-2 rounded-lg h-24"
                                        placeholder="شروط الخدمة، شكراً لزيارتكم..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    حفظ التغييرات
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Backup Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-blue-800">
                                        <Download className="w-5 h-5" />
                                        النسخ الاحتياطي
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1 max-w-lg">
                                        تصدير نسخة كاملة من قاعدة البيانات (المستخدمين، الطلبات، الإعدادات) بتنسيق JSON. يمكنك استخدام هذا الملف لاستعادة البيانات لاحقاً.
                                    </p>
                                </div>
                                <button
                                    onClick={handleBackup}
                                    className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center gap-2 font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    تحميل النسخة
                                </button>
                            </div>
                        </div>

                        {/* Clear Data Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-amber-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-amber-500"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-amber-800">
                                        <Trash2 className="w-5 h-5" />
                                        مسح بيانات العمليات
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1 max-w-lg">
                                        حذف جميع <strong>الطلبات، الحركات المالية، والإشعارات</strong>. سيتم الاحتفاظ بالمستخدمين، الأدوار، والإعدادات العامة.
                                    </p>
                                </div>
                                <button
                                    onClick={handleClearData}
                                    disabled={loading}
                                    className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-100 flex items-center gap-2 font-medium"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    مسح البيانات
                                </button>
                            </div>
                        </div>

                        {/* Factory Reset Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-red-600"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-red-800">
                                        <AlertTriangle className="w-5 h-5" />
                                        ضبط المصنع
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1 max-w-lg">
                                        حذف <strong>كافة البيانات</strong> وإعادة النظام لحالته الأولية. سيتم حذف جميع المستخدمين (ماعدا حسابك الحالي)، الطلبات، والأدوار. لا يمكن التراجع عن هذا الإجراء.
                                    </p>
                                </div>
                                <button
                                    onClick={handleFactoryReset}
                                    disabled={loading}
                                    className="bg-red-50 text-red-700 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 flex items-center gap-2 font-medium"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                                    تهيئة كاملة
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
