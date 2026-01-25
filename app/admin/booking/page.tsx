"use client";

import { useState, useEffect } from "react";
import NavBar from "../../components/NavBar";
import {
    Calendar,
    Trash2,
    Plus,
    Factory,
    ShieldAlert,
    Loader2,
    CalendarDays,
    Clock
} from "lucide-react";

interface CapacityRule {
    id: string;
    factoryId: string | null;
    dayOfWeek: number | null;
    specificDate: string | null;
    maxCapacity: number;
}

interface Facility {
    id: string;
    name: string;
}

const DAYS_OF_WEEK = [
    "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"
];

export default function BookingPage() {
    const [rules, setRules] = useState<CapacityRule[]>([]);
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({
        factoryId: "",
        type: "dayOfWeek", // or "specificDate"
        dayOfWeek: "0",
        specificDate: "",
        maxCapacity: 10
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [rulesRes, facilitiesRes] = await Promise.all([
                fetch('/api/admin/capacity'),
                fetch('/api/facilities')
            ]);
            const [rulesData, facilitiesData] = await Promise.all([
                rulesRes.json(),
                facilitiesRes.json()
            ]);
            setRules(rulesData);
            setFacilities(facilitiesData.filter((f: any) => f.type === 'FACTORY' || f.type === 'ورشة'));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/admin/capacity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    factoryId: form.factoryId || null,
                    dayOfWeek: form.type === 'dayOfWeek' ? parseInt(form.dayOfWeek) : null,
                    specificDate: form.type === 'specificDate' ? form.specificDate : null,
                    maxCapacity: form.maxCapacity
                })
            });
            if (res.ok) {
                fetchData();
                setForm({ ...form, specificDate: "" });
            } else {
                const error = await res.json();
                alert(error.error || "حدث خطأ");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("هل أنت متأكد من حذف هذه القاعدة؟")) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/capacity/${id}`, { method: 'DELETE' });
            if (res.ok) fetchData();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pb-20 bg-background">
            <NavBar />
            <main className="max-w-4xl mx-auto px-4 py-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-foreground">إدارة الحجز والسعة</h1>
                    <p className="text-muted-foreground mt-2">حدد الحد الأقصى للطلبات المقبولة لكل يوم أو مصنع.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* New Rule Form */}
                    <div className="md:col-span-1">
                        <div className="bg-card border border-border rounded-xl p-6 shadow-sm sticky top-8">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5" /> إضافة قاعدة جديدة
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">المصنع / الورشة</label>
                                    <select
                                        title="factory"
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                        value={form.factoryId}
                                        onChange={(e) => setForm({ ...form, factoryId: e.target.value })}
                                    >
                                        <option value="">الكل (تطبيق عام)</option>
                                        {facilities.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">نوع التكرار</label>
                                    <div className="flex bg-muted rounded-lg p-1">
                                        <button
                                            type="button"
                                            className={`flex-1 py-1 text-xs rounded-md ${form.type === 'dayOfWeek' ? 'bg-card shadow-sm' : ''}`}
                                            onClick={() => setForm({ ...form, type: 'dayOfWeek' })}
                                        >أسبوعي</button>
                                        <button
                                            type="button"
                                            className={`flex-1 py-1 text-xs rounded-md ${form.type === 'specificDate' ? 'bg-card shadow-sm' : ''}`}
                                            onClick={() => setForm({ ...form, type: 'specificDate' })}
                                        >تاريخ محدد</button>
                                    </div>
                                </div>

                                {form.type === 'dayOfWeek' ? (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">اليوم</label>
                                        <select
                                            title="dayOfWeek"
                                            className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                            value={form.dayOfWeek}
                                            onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                                        >
                                            {DAYS_OF_WEEK.map((day, i) => (
                                                <option key={i} value={i}>{day}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">التاريخ</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                            value={form.specificDate}
                                            onChange={(e) => setForm({ ...form, specificDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium mb-1">أقصى كمية حجز</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 bg-background border border-border rounded-lg text-sm"
                                        value={form.maxCapacity}
                                        onChange={(e) => setForm({ ...form, maxCapacity: parseInt(e.target.value) })}
                                        min="1"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary text-primary-foreground p-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    حفظ القاعدة
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Rules List */}
                    <div className="md:col-span-2 space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <CalendarDays className="w-5 h-5" /> القواعد الحالية
                        </h2>

                        {rules.length === 0 && !loading ? (
                            <div className="text-center py-12 bg-card border border-border border-dashed rounded-xl">
                                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                                <p className="text-muted-foreground">لا توجد قواعد حجز مفعلة حالياً.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rules.map(rule => (
                                    <div key={rule.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                {rule.specificDate ? <Calendar className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">
                                                        {rule.specificDate ? new Date(rule.specificDate).toLocaleDateString('ar-LY') : DAYS_OF_WEEK[rule.dayOfWeek!]}
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
                                                        {rule.specificDate ? 'يوم محدد' : 'أسبوعي'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Factory className="w-4 h-4" />
                                                        {facilities.find(f => f.id === rule.factoryId)?.name || 'الكل'}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-primary font-medium">
                                                        <ShieldAlert className="w-4 h-4" />
                                                        سعة: {rule.maxCapacity}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            title="delete rule"
                                            onClick={() => handleDelete(rule.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {loading && rules.length > 0 && (
                            <div className="flex justify-center p-4">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
