"use client";

import { useEffect, useState } from "react";

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

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
                <div
                    key={order.id}
                    className="p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-shadow"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
                                {order.customerName}
                            </h3>
                            <p className="text-sm text-zinc-500">{order.status}</p>
                        </div>
                        <span className="px-3 py-1 text-sm font-medium bg-zinc-100 dark:bg-zinc-800 rounded-full">
                            ${order.totalAmount}
                        </span>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        تاريخ الاستحقاق: {order.dueDate}
                    </div>
                </div>
            ))}
        </div>
    );
}
