"use client";

import { useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import OrderList from '../components/OrderList';
import Link from 'next/link';
import { Plus, Filter, Search, Calendar, Factory as FactoryIcon, ChevronDown, ChevronUp, Menu, X } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';
import { ORDER_STATUS } from '@/lib/constants';
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
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <NavBar />
            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">سجل الطلبات</h1>
                        <p className="text-muted-foreground mt-1">إدارة الطلبات، تتبع الحالات، والبحث المتقدم.</p>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium bg-card text-foreground border border-border hover:bg-muted"
                        >
                            <Menu className="w-5 h-5" />
                            <span>الأقسام</span>
                        </button>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium border ${showFilters ? 'bg-primary text-white border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
                        >
                            <Filter className="w-5 h-5" />
                            <span>فلاتر متقدمة</span>
                            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                        </button>
                        {hasPermission(PERMISSIONS.ORDERS_ADD) && (
                            <Link
                                href="/orders/new"
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-primary to-amber-500 text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-bold"
                            >
                                <Plus className="w-5 h-5" />
                                <span>طلب جديد</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Advanced Filters Panel */}
                {showFilters && (
                    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mb-8 animate-in slide-in-from-top duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                    <Search className="w-3 h-3" /> اسم العميل
                                </label>
                                <input
                                    type="text"
                                    placeholder="ابحث بالاسم..."
                                    className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={filters.customerName}
                                    onChange={e => setFilters({ ...filters, customerName: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                    <FactoryIcon className="w-3 h-3" /> المصنع / الورشة
                                </label>
                                <select
                                    title="filter factory"
                                    className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={filters.factoryId}
                                    onChange={e => setFilters({ ...filters, factoryId: e.target.value })}
                                >
                                    <option value="">الكل</option>
                                    {facilities.filter(f => f.type === 'FACTORY' || f.type === 'ورشة').map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> التاريخ من
                                </label>
                                <input
                                    type="date"
                                    title="التاريخ من"
                                    placeholder="من تاريخ"
                                    className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={filters.startDate}
                                    onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> التاريخ إلى
                                </label>
                                <input
                                    type="date"
                                    title="التاريخ إلى"
                                    placeholder="إلى تاريخ"
                                    className="w-full bg-muted/50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                    value={filters.endDate}
                                    onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end mt-6 gap-2 pt-4 border-t border-border/50">
                            <button
                                onClick={() => setFilters({ factoryId: '', startDate: '', endDate: '', paymentStatus: 'ALL', customerName: '' })}
                                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                            >تنظيف الفلاتر</button>
                        </div>
                    </div>
                )}


                {/* Sidebar Drawer - Overlay */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-50 flex justify-start">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
                            onClick={() => setIsSidebarOpen(false)}
                        />

                        {/* Drawer Content */}
                        <aside className="relative w-80 h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                            <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                                <h3 className="text-xl font-bold text-foreground">أقسام الطلبات</h3>
                                <button
                                    onClick={() => setIsSidebarOpen(false)}
                                    className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                    aria-label="إغلاق القائمة"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <nav className="flex flex-col gap-2 overflow-y-auto flex-1">
                                {[
                                    { id: 'ALL', label: 'الكل', color: 'bg-zinc-500' },
                                    { id: 'FACTORY_INBOX', label: 'المصنع (وارد)', color: 'bg-orange-500' },
                                    { id: 'SHOP_INBOX', label: 'المحل (وارد)', color: 'bg-indigo-500' },
                                    { id: 'COMPLETED', label: 'المكتملة', color: 'bg-green-500' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                            setIsSidebarOpen(false);
                                        }}
                                        className={`w-full text-right px-4 py-3 rounded-lg text-sm font-bold transition-all flex justify-between items-center ${activeTab === tab.id
                                            ? 'bg-primary/10 text-primary border-r-4 border-primary'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${tab.color}`} />
                                            <span>{tab.label}</span>
                                        </div>
                                        {activeTab === tab.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
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
