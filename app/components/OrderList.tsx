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

export default function OrderList() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOrders() {
            try {
                const res = await fetch("/api/orders");
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
    }, []);

    if (loading) {
        return <div className="text-center p-4 text-zinc-500">جاري تحميل الطلبات...</div>;
    }

    if (orders.length === 0) {
        return (
            <div className="text-center p-8 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                <p className="text-zinc-500">لا توجد طلبات.</p>
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
                    className="group relativebg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-lg transition-all hover:bg-muted/30"
                >
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
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${order.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' :
                            order.status === 'REGISTERED' ? 'bg-blue-500/10 text-blue-600' :
                                'bg-zinc-500/10 text-zinc-600'
                            }`}>
                            {
                                order.status === 'REGISTERED' ? 'مسجل' :
                                    order.status === 'COMPLETED' ? 'مكتمل' : order.status
                            }
                        </span>
                    </div>

                    <div className="flex justify-between items-end border-t border-border pt-4 mt-2">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">المبلغ الإجمالي</p>
                            <p className="text-lg font-bold text-foreground font-mono" dir="ltr">${order.totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">تاريخ الاستحقاق</p>
                            <p className="text-sm font-medium text-foreground font-mono flex items-center gap-1 justify-end">
                                {order.dueDate}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-2 border-t border-border/50">
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
