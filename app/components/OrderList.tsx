"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePermission } from "@/lib/usePermission";
import { PERMISSIONS } from "@/lib/permissions";
import { getStatusInfo, formatCurrency, formatDate } from "@/lib/utils";

interface Order {
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    dueDate: string;
}

interface OrderListProps {
    queryParams?: string;
}

export default function OrderList({ queryParams }: OrderListProps) {
    const { hasPermission } = usePermission();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return <div className="text-center p-4 text-zinc-500">جاري تحميل الطلبات...</div>;
    }

    if (orders.length === 0) {
        return (
            <div className="text-center p-8 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                <p className="text-zinc-500">لا توجد طلبات في هذه القائمة.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                return (
                    <div
                        key={order.id}
                        className="group relative bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-0 shadow-2xl hover:shadow-primary/5 transition-all duration-500 hover:-translate-y-1 overflow-hidden glass"
                    >
                        <Link href={`/orders/${order.id}`} className="block p-6 cursor-pointer">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-amber-900/20 border border-primary/20 flex items-center justify-center text-primary font-black text-xl shadow-inner">
                                        {order.customerName.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg text-foreground antialiased tracking-tight group-hover:text-primary transition-colors">
                                            {order.customerName}
                                        </h3>
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 mt-0.5">#{order.id.slice(-6).toUpperCase()}</p>
                                    </div>
                                </div>
                                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg border shadow-sm ${statusInfo.color} border-current/20 gold-glow`}>
                                    {statusInfo.label}
                                </span>
                            </div>

                            <div className="flex justify-between items-end border-t border-white/5 pt-6 mt-4">
                                {hasPermission(PERMISSIONS.ORDERS_VIEW_FINANCIALS) && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">المبلغ المستحق</p>
                                        <p className="text-xl font-black text-foreground font-mono antialiased" dir="ltr">{formatCurrency(order.totalAmount)}</p>
                                    </div>
                                )}
                                <div className="text-right space-y-1">
                                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">موعد التسليم</p>
                                    <p className="text-sm font-black text-primary font-mono antialiased">
                                        {formatDate(order.dueDate)}
                                    </p>
                                </div>
                            </div>
                        </Link>

                        <div className="flex gap-2 p-6 pt-0">
                            {hasPermission(PERMISSIONS.ORDERS_EDIT) && (
                                <Link
                                    href={`/orders/${order.id}/edit`}
                                    className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-center text-foreground bg-white/5 rounded-xl border border-white/5 hover:bg-primary hover:text-white hover:border-primary transition-all duration-300"
                                >
                                    تعديل المعلومات
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
