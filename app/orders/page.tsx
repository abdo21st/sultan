"use client";

import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import OrderList from '../components/OrderList';
import Link from 'next/link';
import { Plus, Filter, Search, Calendar, Factory as FactoryIcon, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from '@/lib/constants';
import { exportOrdersToPDF, type OrderExportData } from '@/lib/pdf-export';
import { toast } from 'react-hot-toast';
/* FACILITY_TYPE was not used directly here */

interface Facility {
    id: string;
    name: string;
    type: string;
}

export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState('ALL');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { hasPermission } = usePermission();
    const [showFilters, setShowFilters] = useState(false);
    const [facilities, setFacilities] = useState<Facility[]>([]);

    // Advanced Filters State
    const [filters, setFilters] = useState({
        factoryId: '',
        startDate: '',
        endDate: '',
        paymentStatus: 'ALL', // ALL, PAID, DEBT
        customerName: ''
    });

    useEffect(() => {
        if (hasPermission(PERMISSIONS.FACILITIES_VIEW)) {
            fetch('/api/facilities')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setFacilities(data);
                    } else {
                        console.error('Failed to load facilities:', data);
                        setFacilities([]);
                    }
                })
                .catch(err => {
                    console.error('Error fetching facilities:', err);
                    setFacilities([]);
                });
        }
    }, [hasPermission]);

    const getStatusQuery = (tab: string) => {
        switch (tab) {
            case 'FACTORY_INBOX': return `${ORDER_STATUS.DELIVERING_TO_FACTORY},${ORDER_STATUS.PROCESSING}`;
            case 'SHOP_INBOX': return `${ORDER_STATUS.SHOP_READY},${ORDER_STATUS.REVIEW}`;
            case 'COMPLETED': return ORDER_STATUS.COMPLETED;
            default: return '';
        }
    };

    const buildQuery = () => {
        const params = new URLSearchParams();
        const status = getStatusQuery(activeTab);
        if (status) params.append('status', status);
        if (filters.factoryId) params.append('factoryId', filters.factoryId);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.customerName) params.append('customerName', filters.customerName);
        return params.toString();
    };

    return (
        <div className="min-h-screen bg-background pb-20 selection:bg-primary/30 antialiased">
            <NavBar />
            <main className="max-w-7xl mx-auto px-4 py-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
                    <div>
                        <h1 className="text-4xl font-black text-gradient-gold tracking-tight mb-2">سجل الطلبات الملكي</h1>
                        <p className="text-sm text-muted-foreground/60 font-bold uppercase tracking-widest">إدارة شاملة، تتبع دقيق، وتحكم كامل في المسار.</p>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest bg-amber-700 text-white hover:bg-amber-600 hover:scale-105 shadow-sm"
                        >
                            <Menu className="w-5 h-5 text-white" />
                            <span>الأقسام</span>
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest border ${showFilters ? 'bg-amber-700 text-white border-amber-700 shadow-gold scale-105' : 'bg-amber-700 text-white hover:bg-amber-600 hover:scale-105 border-amber-700 shadow-sm'}`}
                        >
                            <Filter className="w-5 h-5" />
                            <span>فلاتر متقدمة</span>
                            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    // We need the orders data. It's inside the OrderList child.
                                    // However, for simplicity and since we are on the client, 
                                    // we can fetch the filtered data again or use a ref.
                                    // Let's fetch the same query to get ALL filtered data (not just page 1)
                                    const url = `/api/orders?${buildQuery()}`;
                                    const res = await fetch(url);
                                    if (res.ok) {
                                        const data = await res.json();
                                        const exportData: OrderExportData[] = data.map((o: { serialNumber: number; customerName: string; totalAmount: number; status: string; dueDate: string }) => ({
                                            serialNumber: o.serialNumber,
                                            customerName: o.customerName,
                                            totalAmount: o.totalAmount,
                                            status: ORDER_STATUS_LABELS[o.status] || o.status,
                                            dueDate: o.dueDate
                                        }));
                                        exportOrdersToPDF(exportData, 'تقرير طلبات سلطان');
                                        toast.success('تم تصدير ملف PDF بنجاح 📄✅');
                                    }
                                } catch (err) {
                                    console.error('Export PDF Error:', err);
                                    toast.error('فشل في تصدير ملف PDF ❌');
                                }
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 font-black text-xs uppercase tracking-widest bg-white border-2 border-amber-700 text-amber-700 hover:bg-amber-50 shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M10 13a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2" /><path d="M12 13h1a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1" /><path d="M16 13h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2" /></svg>
                            <span>تصدير PDF</span>
                        </button>
                        {hasPermission(PERMISSIONS.ORDERS_ADD) && (
                            <Link
                                href="/orders/new"
                                className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-3 bg-gradient-to-br from-primary to-amber-700 text-white rounded-2xl hover:shadow-2xl hover:shadow-primary/30 transition-all duration-500 font-black text-xs uppercase tracking-widest gold-glow transform hover:-translate-y-0.5"
                            >
                                <Plus className="w-5 h-5" />
                                <span>إنشاء طلب جديد</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                    <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl mb-12 animate-in slide-in-from-top duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                                    <Search className="w-3 h-3 text-primary" /> اسم العميل
                                </label>
                                <input
                                    type="text"
                                    placeholder="ابحث بالاسم الملكي..."
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-sm font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 text-foreground"
                                    value={filters.customerName}
                                    onChange={e => setFilters({ ...filters, customerName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                                    <FactoryIcon className="w-3 h-3 text-primary" /> المصنع / الورشة
                                </label>
                                <select
                                    title="filter factory"
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-sm font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 appearance-none cursor-pointer text-foreground"
                                    value={filters.factoryId}
                                    onChange={e => setFilters({ ...filters, factoryId: e.target.value })}
                                >
                                    <option value="" className="bg-background text-foreground">الكل</option>
                                    {facilities.filter(f => f.type === 'FACTORY' || f.type === 'ورشة').map(f => (
                                        <option key={f.id} value={f.id} className="bg-background text-foreground">{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-primary" /> التاريخ من
                                </label>
                                <input
                                    type="date"
                                    title="التاريخ من"
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-sm font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 text-foreground"
                                    value={filters.startDate}
                                    onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-primary" /> التاريخ إلى
                                </label>
                                <input
                                    type="date"
                                    title="التاريخ إلى"
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-sm font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-300 text-foreground"
                                    value={filters.endDate}
                                    onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-8 gap-4 pt-6 border-t border-border">
                            <button
                                onClick={() => setFilters({ factoryId: '', startDate: '', endDate: '', paymentStatus: 'ALL', customerName: '' })}
                                className="px-6 py-2 text-xs font-black text-muted-foreground/60 hover:text-primary transition-colors uppercase tracking-widest"
                            >تفريغ الفلاتر</button>
                        </div>
                    </div>
                )}


                {/* Sidebar Drawer - Overlay */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-[60] flex justify-start">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-500"
                            onClick={() => setIsSidebarOpen(false)}
                        />

                        {/* Drawer Content */}
                        <aside className="relative w-85 h-full bg-background border-l border-border p-10 shadow-3xl animate-in slide-in-from-right duration-500 flex flex-col">
                            <div className="flex justify-between items-center mb-10 border-b border-border pb-6">
                                <h3 className="text-2xl font-black text-gradient-gold tracking-tighter">أقسام السلطان</h3>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="p-3 hover:bg-primary/10 rounded-full transition-all duration-300 text-muted-foreground hover:text-primary"
                                    aria-label="إغلاق القائمة"
                                >
                                    <X className="w-7 h-7" />
                                </button>
                            </div>

                            <nav className="flex flex-col gap-3 overflow-y-auto flex-1 pr-2">
                                {[
                                    { id: 'ALL', label: 'كافة الطلبات', color: 'bg-zinc-500' },
                                    { id: 'FACTORY_INBOX', label: 'وارد المصانع', color: 'bg-orange-500' },
                                    { id: 'SHOP_INBOX', label: 'وارد المعارض', color: 'bg-indigo-500' },
                                    { id: 'COMPLETED', label: 'السجل المكتمل', color: 'bg-green-500' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsSidebarOpen(false);
                                        }}
                                        className={`w-full text-right px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-500 flex justify-between items-center border ${activeTab === tab.id
                                            ? 'bg-primary/10 text-primary border-primary/30 shadow-[0_0_15px_rgba(217,119,6,0.1)] translate-x-1'
                                            : 'text-muted-foreground/60 hover:bg-primary/5 hover:text-foreground border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${tab.color} shadow-sm transition-transform duration-500 ${activeTab === tab.id ? 'scale-125' : ''}`} />
                                            <span>{tab.label}</span>
                                        </div>
                                        {activeTab === tab.id && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                                    </button>
                                ))}
                            </nav>
                        </aside>
                    </div>
                )}

                {/* Main Content - Full Width */}
                <div className="w-full">
                    <OrderList queryParams={buildQuery()} />
                </div>
            </main>
        </div>
    );
}
