"use client";

import { useState } from "react";
import { X, Filter, Check, Calendar, Search, Banknote } from "lucide-react";
import { ORDER_STATUS, ORDER_STATUS_LABELS } from "@/lib/constants";

export interface FilterState {
    customerName: string;
    status: string[];
    startDate: string;
    endDate: string;
    paymentStatus: string;
}

interface OrderFiltersProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    initialFilters: Partial<FilterState>;
}

export default function OrderFilters({ isOpen, onClose, onApply, initialFilters }: OrderFiltersProps) {
    const [filters, setFilters] = useState<FilterState>({
        customerName: initialFilters.customerName || "",
        status: initialFilters.status || [],
        startDate: initialFilters.startDate || "",
        endDate: initialFilters.endDate || "",
        paymentStatus: initialFilters.paymentStatus || ""
    });

    // Effect removed as we rely on mounting to reset state (controlled by parent)

    if (!isOpen) return null;

    const handleStatusToggle = (status: string) => {
        setFilters(prev => {
            const newStatus = prev.status.includes(status)
                ? prev.status.filter(s => s !== status)
                : [...prev.status, status];
            return { ...prev, status: newStatus };
        });
    };

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({
            customerName: "",
            status: [],
            startDate: "",
            endDate: "",
            paymentStatus: ""
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg rounded-3xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <Filter className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-black text-foreground">فلاتر متقدمة</h3>
                    </div>
                    <button onClick={onClose} aria-label="Close filters" className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Customer Name */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-foreground">اسم العميل</label>
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={filters.customerName}
                                onChange={(e) => setFilters(prev => ({ ...prev, customerName: e.target.value }))}
                                placeholder="بحث باسم العميل..."
                                aria-label="اسم العميل"
                                className="w-full pr-10 pl-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-foreground">حالة الطلب</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(ORDER_STATUS_LABELS).filter(([key]) => (Object.values(ORDER_STATUS) as readonly string[]).includes(key)).map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => handleStatusToggle(value)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-xs font-bold ${filters.status.includes(value)
                                        ? 'bg-primary/5 border-primary text-primary shadow-inner'
                                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                                        }`}
                                >
                                    <span>{label}</span>
                                    {filters.status.includes(value) && <Check className="w-3 h-3" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-foreground">من تاريخ</label>
                            <div className="relative">
                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="w-full pr-10 pl-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    aria-label="من تاريخ"
                                />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-foreground">إلى تاريخ</label>
                            <div className="relative">
                                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="w-full pr-10 pl-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm text-sm"
                                    aria-label="إلى تاريخ"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Status */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-foreground">الحالة المالية</label>
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, paymentStatus: prev.paymentStatus === 'unpaid' ? '' : 'unpaid' }))}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${filters.paymentStatus === 'unpaid'
                                ? 'bg-red-500/5 border-red-500 text-red-600 shadow-inner'
                                : 'bg-background border-border text-muted-foreground hover:bg-muted'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Banknote className="w-4 h-4" />
                                <span className="text-sm font-bold">عرض الديون المستحقة فقط</span>
                            </div>
                            {filters.paymentStatus === 'unpaid' && <Check className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-border bg-muted/30 flex gap-3">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-3 bg-background border border-border rounded-xl text-foreground font-bold hover:bg-muted transition-colors"
                    >
                        إعادة تعيين
                    </button>
                    <button
                        onClick={handleApply}
                        className="flex-[2] py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        تطبيق الفلاتر
                    </button>
                </div>
            </div>
        </div>
    );
}
