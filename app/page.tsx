"use client";

import Link from "next/link";
import OrderList from "./components/OrderList";
import {
  PlusCircle,
  FileDown
} from "lucide-react";
import NavBar from "./components/NavBar";
import { usePermission } from "@/lib/usePermission";
import { PERMISSIONS } from "@/lib/permissions";
import { useState } from "react";
import DateTabs, { GroupingMode } from "./components/DateTabs"; // Changed import to include GroupingMode and removed DateRangeType
import OrderFilters, { FilterState } from "./components/OrderFilters";
import { exportOrdersToPDF, type OrderExportData } from '@/lib/pdf-export';
import { useToast } from './components/ToastProvider';
import { ORDER_STATUS_LABELS } from '@/lib/constants';

export default function Home() {
  const { hasPermission } = usePermission();
  const { showToast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [queryParams, setQueryParams] = useState("");
  const [activeFilters, setActiveFilters] = useState<Partial<FilterState>>({});
  const [activeGrouping, setActiveGrouping] = useState<GroupingMode>("none"); // Changed from activeDateTab to activeGrouping

  // Simplified updateQueryParams to only handle filters, no date tab logic
  const updateQueryParams = (filters: Partial<FilterState>) => {
    const params = new URLSearchParams();

    // Merge filters
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length > 0) params.set(key, value.join(','));
      } else if (value) {
        params.set(key, value as string);
      }
    });

    setQueryParams(params.toString());
  };

  const handleApplyFilters = (filters: FilterState) => {
    setActiveFilters(filters);
    // No longer need to reset quick tabs or handle date filters separately here
    updateQueryParams(filters);
  };

  // New handler for grouping mode changes
  const handleGroupingChange = (mode: GroupingMode) => {
    setActiveGrouping(mode);
  };

  // Removed handleDateTabChange as activeDateTab is no longer used

  // Simplified hasActiveFilters
  const hasActiveFilters = Object.values(activeFilters).some(v =>
    (Array.isArray(v) ? v.length > 0 : !!v)
  );

  return (
    <div className="min-h-screen pb-20">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-1 w-12 bg-primary rounded-full" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">منصة الإدارة الذكية</span>
            </div>
            <h1 className="text-5xl font-black text-foreground tracking-tight antialiased">
              سجل <span className="text-gradient-gold">الطلبات</span>
            </h1>
            <p className="text-muted-foreground font-semibold text-lg max-w-xl leading-relaxed">
              نظام متكامل لإدارة الطلبات، تتبع دقيق للمسار، وتحكم شامل في كافة العمليات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={async () => {
                try {
                  const url = `/api/orders?${queryParams}`;
                  const res = await fetch(url);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.length === 0) {
                      showToast('لا توجد طلبات لتصديرها ⚠️', 'warning');
                      return;
                    }
                    const exportData: OrderExportData[] = data.map((o: { serialNumber: number; customerName: string; totalAmount: number; status: string; dueDate: string }) => ({
                      serialNumber: o.serialNumber,
                      customerName: o.customerName,
                      totalAmount: o.totalAmount,
                      status: ORDER_STATUS_LABELS[o.status] || o.status,
                      dueDate: o.dueDate
                    }));
                    exportOrdersToPDF(exportData, 'تقرير طلبات سلطان');
                    showToast('تم تصدير ملف PDF بنجاح 📄✅', 'success');
                  } else {
                    showToast('فشل في جلب بيانات الطلبات ❌', 'error');
                  }
                } catch (err) {
                  console.error('Export PDF Error:', err);
                  showToast('حدث خطأ غير متوقع ❌', 'error');
                }
              }}
              className="h-14 px-8 rounded-2xl transition-all duration-300 font-black text-sm tracking-wide bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 hover:scale-105 hover:shadow-2xl hover:shadow-red-500/30 shadow-lg border-2 border-red-800/20 flex items-center gap-3 active:scale-95"
            >
              <FileDown className="w-6 h-6" strokeWidth={2.5} />
              <span>تصدير PDF</span>
            </button>

            <button
              onClick={() => setShowFilters(true)}
              className={`h-14 px-6 rounded-2xl border-2 transition-all duration-300 flex items-center gap-3 font-black text-sm active:scale-95 ${hasActiveFilters
                ? 'bg-primary/5 border-primary text-primary shadow-gold'
                : 'border-border/60 bg-card hover:border-primary/30 text-foreground shadow-sm'
                }`}
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <span className="text-lg">⚡</span>
              </div>
              <span>فلاتر متقدمة</span>
              {hasActiveFilters && (
                <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full ring-4 ring-primary/10">
                  !
                </span>
              )}
            </button>

            {hasPermission(PERMISSIONS.ORDERS_ADD) && (
              <Link
                href="/orders/new"
                className="h-14 px-8 rounded-2xl bg-gradient-to-br from-primary to-amber-800 text-white font-black text-sm flex items-center gap-3 shadow-gold transition-all hover:scale-105 active:scale-95 border-b-4 border-amber-950/20"
              >
                <PlusCircle className="w-5 h-5" strokeWidth={3} />
                <span>طلب جديد</span>
              </Link>
            )}
          </div>
        </div>

        {/* Quick Indexing Section */}
        <section className="space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60">تحليل الفهرسة الزمنية</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-border/40 to-transparent" />
          </div>
          <div className="flex justify-center md:justify-start">
            <DateTabs activeMode={activeGrouping} onModeChange={handleGroupingChange} />
          </div>
        </section>

        {/* Orders List Section */}
        <section className="space-y-6">
          <OrderList queryParams={queryParams} groupingMode={activeGrouping} />
        </section>
      </main>

      {showFilters && (
        <OrderFilters
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          onApply={handleApplyFilters}
          initialFilters={activeFilters}
        />
      )}
    </div>
  );
}
