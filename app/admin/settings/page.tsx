'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Save, Download, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/app/components/ToastProvider';
import { DESTRUCTIVE_CONFIRMATIONS } from '@/lib/constants';

export default function SettingsPage() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'general' | 'whatsapp' | 'actions'>('general');
    const [loading, setLoading] = useState(false);
    const [hasWhatsappApiKey, setHasWhatsappApiKey] = useState(false);
    const [clearWhatsappApiKey, setClearWhatsappApiKey] = useState(false);
    const [settings, setSettings] = useState({
        appName: '',
        logoUrl: '',
        printHeader: '',
        printFooter: '',
        themeColor: '#796453',
        whatsappAutoSend: false,
        whatsappApiUrl: '',
        whatsappApiKey: ''
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
                        themeColor: data.themeColor || '#796453',
                        whatsappAutoSend: data.whatsappAutoSend || false,
                        whatsappApiUrl: data.whatsappApiUrl || '',
                        whatsappApiKey: ''
                    });
                    setHasWhatsappApiKey(Boolean(data.hasWhatsappApiKey));
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
                body: JSON.stringify({ ...settings, clearWhatsappApiKey })
            });
            if (res.ok) {
                setHasWhatsappApiKey(clearWhatsappApiKey || settings.whatsappApiKey ? !clearWhatsappApiKey : hasWhatsappApiKey);
                setClearWhatsappApiKey(false);
                setSettings(current => ({ ...current, whatsappApiKey: '' }));
                showToast('تم حفظ الإعدادات بنجاح', 'success');
                window.dispatchEvent(new Event('sultan:settings-updated'));
            } else showToast('حدث خطأ أثناء حفظ الإعدادات', 'error');
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
        const confirmation = prompt(`تحذير: سيتم حذف جميع الطلبات والحركات المالية والإشعارات. اكتب ${DESTRUCTIVE_CONFIRMATIONS.CLEAR_OPERATIONAL_DATA} للمتابعة.`);
        if (confirmation !== DESTRUCTIVE_CONFIRMATIONS.CLEAR_OPERATIONAL_DATA) return;

        setLoading(true);
        try {
            const res = await fetch('/api/settings/clear-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation }),
            });
            const data = await res.json();
            if (res.ok) showToast(data.message, 'success');
            else showToast(data.error || 'حدث خطأ أثناء مسح البيانات', 'error');
        } catch {
            alert('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    const handleFactoryReset = async () => {
        const confirmMsg = "تحذير خطير: سيتم حذف جميع البيانات بما في ذلك الطلبات، المستخدمين، والأدوار والعودة لحالة المصنع.\n\nهل أنت متأكد تماماً؟";
        if (!confirm(confirmMsg)) return;
        const confirmation = prompt(`اكتب ${DESTRUCTIVE_CONFIRMATIONS.FACTORY_RESET} لتأكيد إعادة الضبط.`);
        if (confirmation !== DESTRUCTIVE_CONFIRMATIONS.FACTORY_RESET) return;

        setLoading(true);
        try {
            const res = await fetch('/api/settings/factory-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, 'success');
                window.location.href = '/login';
            } else {
                showToast(data.error || 'حدث خطأ أثناء إعادة الضبط', 'error');
            }
        } catch {
            alert('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllUsers = async () => {
        const confirmMsg = "تحذير: سيتم حذف جميع المستخدمين (ماعدا حسابك الحالي).\n\nهل أنت متأكد؟";
        if (!confirm(confirmMsg)) return;
        const confirmation = prompt(`اكتب ${DESTRUCTIVE_CONFIRMATIONS.BULK_DELETE_USERS} لتأكيد حذف باقي المستخدمين.`);
        if (confirmation !== DESTRUCTIVE_CONFIRMATIONS.BULK_DELETE_USERS) return;

        setLoading(true);
        try {
            const res = await fetch('/api/users/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmation }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, 'success');
            } else {
                showToast(data.error || 'حدث خطأ أثناء حذف المستخدمين', 'error');
            }
        } catch {
            alert('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-full bg-gray-50/50 pb-10">

            <div className="ui-page max-w-4xl">
                <h1 className="text-2xl font-bold mb-6">إعدادات النظام</h1>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6 border-b border-border">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
                    >
                        الإعدادات العامة
                    </button>
                    <button
                        onClick={() => setActiveTab('whatsapp')}
                        className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'whatsapp' ? 'border-green-500 text-green-600' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
                    >
                        الواتساب
                    </button>
                    <Link href="/facilities" className="pb-3 px-4 text-sm text-primary">المنشآت</Link>
                    <button
                        onClick={() => setActiveTab('actions')}
                        className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'actions' ? 'border-red-500 text-red-600' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
                    >
                        إجراءات النظام والبيانات
                    </button>
                </div>

                {activeTab === 'general' ? (
                    <div className="bg-card p-6 rounded-xl  border">
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
                                    <label className="text-sm font-medium">لون التمييز</label>
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
                                            className="w-28 border border-border p-2 rounded-lg text-left text-sm"
                                            dir="ltr"
                                            aria-label="كود اللون"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">شعار التطبيق — رابط الصورة</label>
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
                ) : activeTab === 'whatsapp' ? (
                    <div className="bg-card p-6 rounded-xl  border">
                        <form onSubmit={handleSaveSettings} className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                                    <div>
                                        <h3 className="font-bold text-green-800">إرسال المستندات تلقائياً عبر الواتساب</h3>
                                        <p className="text-sm text-gray-600 mt-1">عند نقل الطلب إلى قيد التجهيز أو جاهز للمحل، يُرسل المستند لرقم العميل. يجب أن يمتلك منفذ النقل صلاحية إرسال WhatsApp.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.whatsappAutoSend}
                                            onChange={e => setSettings({ ...settings, whatsappAutoSend: e.target.checked })}
                                            className="sr-only peer"
                                            aria-label="تفعيل إرسال المستندات تلقائياً عبر الواتساب"
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-card after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">رابط WhatsApp API</label>
                                    <input
                                        value={settings.whatsappApiUrl}
                                        onChange={e => setSettings({ ...settings, whatsappApiUrl: e.target.value })}
                                        className="w-full border p-2 rounded-lg text-left"
                                        dir="ltr"
                                        placeholder="https://api.whatsapp.com/send"
                                    />
                                    <p className="text-xs text-gray-500">يجب أن يكون اسم النطاق ضمن WHATSAPP_API_ALLOWED_HOSTS في إعدادات الخادم.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">مفتاح API</label>
                                    <input
                                        type="password"
                                        value={settings.whatsappApiKey}
                                        onChange={e => setSettings({ ...settings, whatsappApiKey: e.target.value })}
                                        className="w-full border p-2 rounded-lg text-left"
                                        dir="ltr"
                                        placeholder={hasWhatsappApiKey ? 'مفتاح محفوظ؛ اكتب قيمة جديدة لاستبداله' : 'أدخل مفتاح API'}
                                    />
                                    <label className="flex items-center gap-2 text-sm text-red-700">
                                        <input
                                            type="checkbox"
                                            checked={clearWhatsappApiKey}
                                            onChange={e => setClearWhatsappApiKey(e.target.checked)}
                                        />
                                        حذف المفتاح المحفوظ
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    حفظ إعدادات الواتساب
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Backup Section */}
                        <div className="bg-card p-6 rounded-xl  border border-blue-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-blue-500"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-blue-800">
                                        <Download className="w-5 h-5" />
                                        تصدير البيانات
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1 max-w-lg">
                                        تنزيل تصدير إداري بصيغة JSON. هذا الملف ليس نسخة كاملة قابلة لاستعادة قاعدة البيانات؛ استخدم أداة النسخ والاستعادة المشفّرة الموضحة في دليل التشغيل.
                                    </p>
                                </div>
                                <button
                                    onClick={handleBackup}
                                    className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 flex items-center gap-2 font-medium"
                                >
                                    <Download className="w-4 h-4" />
                                    تنزيل التصدير
                                </button>
                            </div>
                        </div>

                        {/* Delete All Users Section */}
                        <div className="bg-card p-6 rounded-xl  border border-orange-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-2 h-full bg-orange-500"></div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-orange-800">
                                        <Trash2 className="w-5 h-5" />
                                        حذف جميع المستخدمين
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1 max-w-lg">
                                        حذف <strong>جميع المستخدمين</strong> (ماعدا حسابك الحالي). سيتم الاحتفاظ بالطلبات والبيانات الأخرى.
                                    </p>
                                </div>
                                <button
                                    onClick={handleDeleteAllUsers}
                                    disabled={loading}
                                    className="bg-orange-50 text-orange-700 border border-orange-200 px-4 py-2 rounded-lg hover:bg-orange-100 flex items-center gap-2 font-medium"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    حذف المستخدمين
                                </button>
                            </div>
                        </div>

                        {/* Clear Data Section */}
                        <div className="bg-card p-6 rounded-xl  border border-amber-100 relative overflow-hidden">
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
                        <div className="bg-card p-6 rounded-xl  border border-red-100 relative overflow-hidden">
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
