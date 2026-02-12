"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Calendar, ArrowRight, Edit3, ShoppingBag, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { GroupingMode } from "./DateTabs";

interface Order {
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    dueDate: string;
    serialNumber: number;
    images?: string[];
}

interface OrderListProps {
    queryParams?: string;
    groupingMode?: GroupingMode;
}

export default function OrderList({ queryParams, groupingMode = 'none' }: OrderListProps) {
    const { data: session } = useSession();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const ordersPerPage = 20;

    const hasPermission = (permission: string) => {
        return session?.user?.permissions?.includes(permission);
    };

    useEffect(() => {
        async function fetchOrders() {
            setLoading(true);
            try {
                const url = queryParams ? `/api/orders?${queryParams}` : "/api/orders";
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data);
                }
            } catch (error) {
                console.error("Failed to fetch orders", error);
            } finally {
                setLoading(false);
            }
        }
        fetchOrders();
    }, [queryParams]);

    // Grouping Logic
    // Pagination calculations
    const totalPages = Math.ceil(orders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const currentOrders = orders.slice(startIndex, endIndex);

    const groupedOrders = useMemo(() => {
        if (groupingMode === 'none') return { 'الكل': currentOrders };

        const groups: Record<string, Order[]> = {};

        currentOrders.forEach(order => {
            const date = new Date(order.dueDate);
            let key = "";

            if (groupingMode === 'day') {
                key = date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            } else if (groupingMode === 'week') {
                // Get Saturday of that week (start)
                const d = new Date(date);
                const day = d.getDay();
                const diff = (day >= 6 ? day - 6 : day + 1);
                d.setDate(d.getDate() - diff);
                const end = new Date(d);
                end.setDate(d.getDate() + 6);
                key = `أسبوع ${d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}`;
            } else if (groupingMode === 'month') {
                key = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
            }

            if (!groups[key]) groups[key] = [];
            groups[key].push(order);
        });

        return groups;
    }, [currentOrders, groupingMode]);

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                {[1, 2].map((i) => (
                    <div key={i} className="space-y-4">
                        <div className="h-8 w-48 bg-muted rounded-lg" />
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map((j) => (
                                <div key={j} className="h-64 bg-card border border-border rounded-3xl" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-24 bg-muted/10 rounded-[3rem] border-2 border-dashed border-border/30 animate-in fade-in zoom-in-95 duration-700">
                <div className="w-24 h-24 bg-muted/30 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <ShoppingBag className="w-12 h-12 text-muted-foreground/20" />
                </div>
                <h3 className="text-3xl font-black text-foreground mb-3 antialiased">قائمة الطلبات فارغة</h3>
                <p className="text-muted-foreground max-w-xs mx-auto font-bold leading-relaxed opacity-70">لم يتم العثور على أي بيانات تطابق معايير الفهرسة الحالية.</p>
                <Link
                    href="/orders/new"
                    className="inline-flex items-center gap-3 mt-10 px-10 py-4 rounded-[1.5rem] bg-amber-700 text-white font-black text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                    إنشاء طلب جديد
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-16">
            {Object.entries(groupedOrders).map(([groupName, groupOrders]) => (
                <div key={groupName} className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    {/* Group Header */}
                    <div className="flex items-center gap-4 group/header">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm group-hover/header:scale-110 transition-transform duration-500">
                            <ChevronDown className="w-5 h-5 text-primary" strokeWidth={3} />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl font-black text-foreground tracking-tight antialiased">{groupName}</h2>
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{groupOrders.length} طلبات</p>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border/60 to-transparent" />
                    </div>

                    {/* Order Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {groupOrders.map((order) => (
                            <div
                                key={order.id}
                                className="group relative bg-card rounded-[2.5rem] border border-border/40 hover:border-primary/30 transition-all duration-500 shadow-premium hover:shadow-gold overflow-hidden"
                            >
                                {/* Status Accent Bar */}
                                <div className="absolute top-0 right-0 left-0 h-2 bg-muted/20" />

                                {order.images && (order.images as string[]).length > 0 && (
                                    <div className="absolute top-4 left-4 z-10">
                                        <div className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md border border-white/50 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                                            <span className="text-[10px] font-black text-amber-700">+{(order.images as string[]).length}</span>
                                        </div>
                                    </div>
                                )}

                                <div className="p-8 space-y-8">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">التسلسل الرقمي</span>
                                                <span className="text-[11px] font-black text-primary bg-primary/5 px-3 py-1 rounded-xl border border-primary/10 shadow-sm">
                                                    #{order.serialNumber}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-black text-foreground tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                                                {order.customerName}
                                            </h3>
                                        </div>

                                        <div className={`px-5 py-2 rounded-2xl text-[10px] font-black tracking-widest border transition-all duration-500 shadow-sm ${order.status.includes('completed') ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                            order.status.includes('pending') ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                'bg-primary/10 text-primary border-primary/30'
                                            }`}>
                                            {ORDER_STATUS_LABELS[order.status] || order.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-5 rounded-[1.5rem] bg-muted/30 border border-border/20 group-hover:bg-muted/50 transition-all duration-500 shadow-sm">
                                            <span className="block text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider mb-2">القيمة الإجمالية</span>
                                            <p className="text-xl font-black text-foreground tracking-tighter">
                                                {Number(order.totalAmount).toLocaleString()} <span className="text-xs text-muted-foreground/60">د.ل</span>
                                            </p>
                                        </div>
                                        <div className="p-5 rounded-[1.5rem] bg-muted/30 border border-border/20 group-hover:bg-muted/50 transition-all duration-500">
                                            <span className="block text-[10px] font-black text-muted-foreground/60 uppercase tracking-wider mb-2">الاستحقاق</span>
                                            <div className="flex items-center gap-2 text-foreground font-black">
                                                <Calendar className="w-4 h-4 text-primary" strokeWidth={3} />
                                                <span className="text-sm">
                                                    {order.dueDate ? new Date(order.dueDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }) : '---'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-border/40">
                                        <Link
                                            href={`/orders/${order.id}`}
                                            className="flex items-center gap-2.5 text-xs font-black text-primary hover:gap-4 transition-all group/link"
                                        >
                                            <span className="relative">
                                                مراجعة الطلب
                                                <span className="absolute bottom-[-2px] right-0 w-0 h-0.5 bg-primary group-hover/link:w-full transition-all duration-300" />
                                            </span>
                                            <ArrowRight className="w-4 h-4" strokeWidth={3} />
                                        </Link>

                                        {hasPermission(PERMISSIONS.ORDERS_EDIT) && (
                                            <Link
                                                href={`/orders/${order.id}/edit`}
                                                className="w-12 h-12 rounded-2xl bg-amber-700 text-white hover:bg-amber-600 hover:scale-110 flex items-center justify-center transition-all duration-500 shadow-sm group/edit"
                                                title="تعديل سريع"
                                            >
                                                <Edit3 className="w-5 h-5 group-hover/edit:scale-110 transition-transform" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-12 pb-8 px-4">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-12 px-6 rounded-2xl bg-card border border-border text-foreground font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:grayscale hover:bg-muted active:scale-95 transition-all shadow-sm flex items-center gap-2"
                    >
                        <span>السابق</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-12 h-12 rounded-2xl font-black text-xs transition-all duration-500 shadow-sm active:scale-90 ${page === currentPage
                                    ? 'bg-gradient-to-br from-primary to-amber-800 text-white shadow-gold scale-110 border-b-4 border-amber-950/20'
                                    : 'bg-card border border-border text-foreground hover:bg-muted'
                                    }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-12 px-6 rounded-2xl bg-card border border-border text-foreground font-black text-xs uppercase tracking-widest disabled:opacity-30 disabled:grayscale hover:bg-muted active:scale-95 transition-all shadow-sm flex items-center gap-2"
                    >
                        <span>التالي</span>
                    </button>
                </div>
            )}
        </div>
    );
}
