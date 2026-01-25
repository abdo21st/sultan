"use client";

import { useEffect, useState } from 'react';
import NavBar from '@/app/components/NavBar';
import OrderList from '@/app/components/OrderList';
import Link from 'next/link';
import { Plus, Filter, Search, Calendar, Factory as FactoryIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { usePermission } from '@/lib/usePermission';
import { PERMISSIONS } from '@/lib/permissions';

interface Facility {
    id: string;
    name: string;
    type: string;
}

export default function OrdersPage() {
    const [activeTab, setActiveTab] = useState('ALL');
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
        fetch('/api/facilities').then(res => res.json()).then(data => setFacilities(data));
    }, []);

    const getStatusQuery = (tab: string) => {
        switch (tab) {
            case 'FACTORY_INBOX': return 'TRANSFERRED_TO_FACTORY,PROCESSING';
            case 'SHOP_INBOX': return 'TRANSFERRED_TO_SHOP,DELIVERING,REVIEW_NEEDED';
            case 'COMPLETED': return 'COMPLETED';
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

                <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { id: 'ALL', label: 'الكل' },
                        { id: 'FACTORY_INBOX', label: 'المصنع (وارد/تجهيز)' },
                        { id: 'SHOP_INBOX', label: 'المحل (مراجعة/تسليم)' },
                        { id: 'COMPLETED', label: 'المكتملة' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-card text-muted-foreground hover:bg-muted border border-border shadow-sm'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <OrderList queryParams={buildQuery()} />
            </main>
        </div>
    );
}
