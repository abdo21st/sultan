"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Order {
    id: string;
    customerName: string;
    totalAmount: number;
    status: string;
    dueDate: string;
}

const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'مسودة',
    REGISTERED: 'قيد التسجيل',
    TRANSFERRED_TO_FACTORY: 'قيد التحويل للمصنع',
    PROCESSING: 'قيد التجهيز',
    TRANSFERRED_TO_SHOP: 'جاهز للاستلام',
    DELIVERING: 'قيد التسليم',
    COMPLETED: 'مكتمل',
    REVIEW_NEEDED: 'مراجعة مطلوبة'
};

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-zinc-500/10 text-zinc-600',
    REGISTERED: 'bg-blue-500/10 text-blue-600',
    TRANSFERRED_TO_FACTORY: 'bg-amber-500/10 text-amber-600',
    PROCESSING: 'bg-purple-500/10 text-purple-600',
    TRANSFERRED_TO_SHOP: 'bg-green-500/10 text-green-600',
    DELIVERING: 'bg-indigo-500/10 text-indigo-600',
    COMPLETED: 'bg-emerald-500/10 text-emerald-600',
    REVIEW_NEEDED: 'bg-red-500/10 text-red-600'
};

interface OrderListProps {
    statusFilter?: { status?: string[] };
}

export default function OrderList({ statusFilter }: OrderListProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrders() {
            try {
                const res = await fetch("/api/orders");
                if (res.ok) {
                    let data = await res.json();
                    if (statusFilter?.status && statusFilter.status.length > 0) {
                        data = data.filter((o: Order) => statusFilter.status!.includes(o.status));
                    }
                    setOrders(data);
                }
            } catch (error) {
                console.error("Failed to fetch orders", error);
            } finally {
                setLoading(false);
            }
        }
        fetchOrders();
    }, [statusFilter]);

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


    async function handleDelete(id: string) {
        if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
        try {
            await fetch(`/api/orders/${id}`, { method: 'DELETE' });
            setOrders(orders.filter(o => o.id !== id));
        } catch (error) {
            console.error('Failed to delete order', error);
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
                <div
                    key={order.id}
                    className="group relative bg-card border border-border rounded-xl p-0 shadow-sm hover:shadow-lg transition-all hover:bg-muted/30 overflow-hidden"
                >
                    <Link href={`/orders/${order.id}`} className="block p-6 cursor-pointer">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {order.customerName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-foreground truncate max-w-[150px]">
                                        {order.customerName}
                                    </h3>
                                    <p className="text-xs text-muted-foreground font-mono" dir="ltr">#{order.id.slice(-6)}</p>
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[order.status] || 'bg-zinc-100 text-zinc-600'}`}>
                                {STATUS_LABELS[order.status] || order.status}
                            </span>
                        </div>

                        <div className="flex justify-between items-end border-t border-border pt-4 mt-2">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">المبلغ الإجمالي</p>
                                <p className="text-lg font-bold text-foreground font-mono" dir="ltr">{order.totalAmount.toLocaleString()} د.ل</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground mb-1">تاريخ الاستحقاق</p>
                                <p className="text-sm font-medium text-foreground font-mono flex items-center gap-1 justify-end">
                                    {order.dueDate}
                                </p>
                            </div>
                        </div>
                    </Link>

                    <div className="flex gap-2 p-4 pt-0">
                        <Link
                            href={`/orders/${order.id}/edit`}
                            className="flex-1 py-2 text-sm font-medium text-center text-primary bg-primary/5 rounded-lg hover:bg-primary hover:text-white transition-colors"
                        >
                            تعديل
                        </Link>
                        <button
                            onClick={() => handleDelete(order.id)}
                            className="flex-1 py-2 text-sm font-medium text-center text-red-600 bg-red-500/5 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                        >
                            حذف
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
