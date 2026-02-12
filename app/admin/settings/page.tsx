'use client';

import { useState, useEffect } from 'react';
import NavBar from "../../components/NavBar";
import { Save, Download, Trash2, RefreshCw, AlertTriangle, Building2, Plus, X } from 'lucide-react';
import { useToast } from '@/app/components/ToastProvider';

export default function SettingsPage() {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<'general' | 'facilities' | 'actions'>('general');
    const [loading, setLoading] = useState(false);
    const [facilities, setFacilities] = useState<{ id: string; name: string; type: string; location: string; createdAt: string }[]>([]);
    const [newFacility, setNewFacility] = useState({ name: '', type: 'FACTORY', location: '' });
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

    // Fetch facilities
    const fetchFacilities = async () => {
        const res = await fetch('/api/facilities');
        const data = await res.json();
        if (Array.isArray(data)) setFacilities(data);
    };

    useEffect(() => {
        if (activeTab === 'facilities') fetchFacilities();
    }, [activeTab]);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) showToast('تم حفظ الإعدادات بنجاح', 'success');
            else showToast('حدث خطأ أثناء حفظ الإعدادات', 'error');
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
        if (!confirm("تأكيد أخير: هل أنت متأكد؟ العملية لا يمكن التراجع عنها.")) return;

        setLoading(true);
        try {
            const res = await fetch('/api/settings/factory-reset', { method: 'POST' });
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

    const handleCreateFacility = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/facilities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newFacility)
            });
            if (res.ok) {
                showToast('تم إضافة المنشأة بنجاح', 'success');
                setNewFacility({ name: '', type: 'FACTORY', location: '' });
                fetchFacilities();
            } else {
                showToast('حدث خطأ أثناء إضافة المنشأة', 'error');
            }
        } catch {
            alert('حدث خطأ في الاتصال');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFacility = async (id: string, name: string) => {
        if (!confirm(`هل أنت متأكد من حذف المنشأة "${name}"؟`)) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/facilities/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast(data.message, 'success');
                fetchFacilities();
            } else {
                showToast(data.error || 'حدث خطأ أثناء حذف المنشأة', 'error');
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
        if (!confirm("تأكيد أخير: هل أنت متأكد تماما؟")) return;

        setLoading(true);
        try {
            const res = await fetch('/api/users/bulk-delete', { method: 'POST' });
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
                        onClick={() => setActiveTab('facilities')}
                        className={`pb-3 px-4 font-medium transition-colors border-b-2 ${activeTab === 'facilities' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-gray-700'}`}
                    >
                        المنشآت
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
                ) : activeTab === 'facilities' ? (
                    <div className="space-y-6">
                        {/* Create New Facility Form */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5" />
                                إضافة منشأة جديدة
                            </h2>
                            <form onSubmit={handleCreateFacility} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">اسم المنشأة</label>
                                        <input
                                            required
                                            value={newFacility.name}
                                            onChange={e => setNewFacility({ ...newFacility, name: e.target.value })}
                                            className="w-full border p-2 rounded-lg"
                                            placeholder="مثال: المصنع الرئيسي"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">النوع</label>
                                        <select
                                            value={newFacility.type}
                                            onChange={e => setNewFacility({ ...newFacility, type: e.target.value })}
                                            className="w-full border p-2 rounded-lg"
                                            aria-label="نوع المنشأة"
                                        >
                                            <option value="FACTORY">مصنع</option>
                                            <option value="SHOP">معرض</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">الموقع</label>
                                        <input
                                            required
                                            value={newFacility.location}
                                            onChange={e => setNewFacility({ ...newFacility, location: e.target.value })}
                                            className="w-full border p-2 rounded-lg"
                                            placeholder="مثال: القاهرة"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
                                >
                                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    إضافة المنشأة
                                </button>
                            </form>
                        </div>

                        {/* Facilities List */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Building2 className="w-5 h-5" />
                                المنشآت الحالية ({facilities.length})
                            </h2>
                            <div className="space-y-3">
                                {facilities.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">لا توجد منشآت</p>
                                ) : (
                                    facilities.map(facility => (
                                        <div key={facility.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                                            <div>
                                                <h3 className="font-medium">{facility.name}</h3>
                                                <p className="text-sm text-gray-600">
                                                    {facility.type === 'FACTORY' ? 'مصنع' : 'معرض'} • {facility.location}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteFacility(facility.id, facility.name)}
                                                disabled={loading}
                                                className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="حذف المنشأة"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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

                        {/* Delete All Users Section */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-100 relative overflow-hidden">
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
