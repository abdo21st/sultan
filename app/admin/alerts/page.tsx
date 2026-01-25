"use client";

import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar";
import {
    Bell,
    Settings,
    Trash2,
    Plus,
    MessageSquare,
    Clock,
    ExternalLink,
    User,
    Phone,
    Calendar,
    Loader2
} from "lucide-react";
import Link from "next/link";

interface AlertSetting {
    id: string;
    name: string;
    triggerStatus: string;
    timingDays: number;
    whatsappEnabled: boolean;
    recipientPhones: string[];
}

interface Order {
    id: string;
    serialNumber: number;
    customerName: string;
    customerPhone: string;
    dueDate: string;
    status: string;
}

const STATUS_LABELS: Record<string, string> = {
    REGISTERED: "مسجل",
    READY: "جاهز",
    DELIVERED: "تم الاستلام",
    REJECTED: "مرفوض"
};

export default function AlertsPage() {
    const [activeTab, setActiveTab] = useState<'current' | 'settings'>('current');
    const [settings, setSettings] = useState<AlertSetting[]>([]);
    const [matchingOrders, setMatchingOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [newSetting, setNewSetting] = useState({
        name: "",
        triggerStatus: "REGISTERED",
        timingDays: 0,
        whatsappEnabled: false,
        phone: ""
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/alerts');
            const data = await res.json();
            setSettings(data);

            if (activeTab === 'current') {
                // Fetch orders that need attention (e.g., due today or tomorrow)
                const ordersRes = await fetch('/api/orders');
                const ordersData = await ordersRes.json();
                // Simple logic: show orders due today or tomorrow
                const today = new Date().toISOString().split('T')[0];
                const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                setMatchingOrders(ordersData.filter((o: any) => o.dueDate === today || o.dueDate === tomorrow));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSetting = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/admin/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newSetting,
                    recipientPhones: newSetting.phone ? [newSetting.phone] : []
                })
            });
            if (res.ok) {
                setNewSetting({
                    name: "",
                    triggerStatus: "REGISTERED",
                    timingDays: 0,
                    whatsappEnabled: false,
                    phone: ""
                });
                fetchData();
            }
        } finally {
            setLoading(false);
        }
    };

    const openWhatsApp = (phone: string, message: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="min-h-screen pb-20 bg-background">
            <NavBar />
            <main className="max-w-5xl mx-auto px-4 py-8">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">قسم التنبيهات</h1>
                        <p className="text-muted-foreground mt-2">إدارة إشعارات الواتساب ومتابعة الطلبات العاجلة.</p>
                    </div>
                    <div className="flex bg-muted rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'current' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            <Bell className="w-4 h-4" /> تنبيهات اليوم
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            <Settings className="w-4 h-4" /> الإعدادات
                        </button>
                    </div>
                </header>

                {activeTab === 'current' ? (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
                        ) : matchingOrders.length === 0 ? (
                            <div className="text-center py-20 bg-card border border-border border-dashed rounded-2xl">
                                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-10" />
                                <p className="text-muted-foreground">لا توجد طلبات تحتاج لتنبيه حالياً.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {matchingOrders.map(order => (
                                    <div key={order.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md mb-2 inline-block">#{order.serialNumber}</span>
                                                <h4 className="text-lg font-bold flex items-center gap-2"><User className="w-4 h-4" /> {order.customerName}</h4>
                                            </div>
                                            <div className="text-left">
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Calendar className="w-3 h-3" /> {order.dueDate}</span>
                                                <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full mt-1 inline-block">موعد التسليم قريباً</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 py-3 border-y border-border/50 text-sm">
                                            <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-4 h-4" /> {order.customerPhone}</div>
                                            <div className="flex items-center gap-1 text-muted-foreground"><Clock className="w-4 h-4" /> {STATUS_LABELS[order.status] || order.status}</div>
                                        </div>

                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => openWhatsApp(order.customerPhone, `عزيزي ${order.customerName}، نود تذكيرك بموعد استلام طلبك رقم ${order.serialNumber} يوم ${order.dueDate}.`)}
                                                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <MessageSquare className="w-4 h-4" /> إرسال واتساب
                                            </button>
                                            <Link href={`/orders/${order.id}`} className="bg-muted hover:bg-muted/80 text-foreground p-2 rounded-xl transition-colors">
                                                <ExternalLink className="w-5 h-5" />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-1">
                            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5" /> إضافة تنبيه آلي</h3>
                                <form onSubmit={handleAddSetting} className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold mb-1 block">اسم التنبيه</label>
                                        <input
                                            type="text"
                                            className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm"
                                            placeholder="مثلاً: تذكير قبل الاستلام"
                                            value={newSetting.name}
                                            onChange={e => setNewSetting({ ...newSetting, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold mb-1 block">يفعل عند حالة</label>
                                        <select
                                            title="triggerStatus"
                                            className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm"
                                            value={newSetting.triggerStatus}
                                            onChange={e => setNewSetting({ ...newSetting, triggerStatus: e.target.value })}
                                        >
                                            {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                                <option key={val} value={val}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold mb-1 block">التوقيت (بالأيام)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm"
                                            placeholder="0 يعني في نفس اليوم، -1 قبل يوم"
                                            value={newSetting.timingDays}
                                            onChange={e => setNewSetting({ ...newSetting, timingDays: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-xl">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newSetting.whatsappEnabled}
                                                onChange={e => setNewSetting({ ...newSetting, whatsappEnabled: e.target.checked })}
                                            />
                                            <span className="text-sm font-bold">تفعيل إرسال الواتساب</span>
                                        </label>
                                        {newSetting.whatsappEnabled && (
                                            <input
                                                type="text"
                                                placeholder="رقم الواتساب (مثال: 218...)"
                                                className="w-full mt-2 bg-white/50 border-border rounded-lg p-2 text-xs"
                                                value={newSetting.phone}
                                                onChange={e => setNewSetting({ ...newSetting, phone: e.target.value })}
                                            />
                                        )}
                                    </div>
                                    <button
                                        disabled={loading}
                                        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                                    >حفظ الإعدادات</button>
                                </form>
                            </div>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Bell className="w-5 h-5" /> القواعد المفعلة</h3>
                            {settings.map(s => (
                                <div key={s.id} className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Bell className="w-6 h-6" /></div>
                                        <div>
                                            <h4 className="font-bold">{s.name}</h4>
                                            <p className="text-sm text-muted-foreground">عند حالة {STATUS_LABELS[s.triggerStatus]} | موعد {s.timingDays} يوم</p>
                                            {s.whatsappEnabled && <p className="text-xs text-green-600 font-bold mt-1 inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> واتساب مفعل لـ {s.recipientPhones.length} رقم</p>}
                                        </div>
                                    </div>
                                    <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
