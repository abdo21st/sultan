"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { toast } from "react-hot-toast";
import { Wifi, RefreshCw } from "lucide-react";

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        // Check pending orders on mount and periodically
        const checkPending = async () => {
            const count = await db.orders.where('status').equals('pending').count();
            setPendingCount(count);
        };

        checkPending();
        const interval = setInterval(checkPending, 30000); // Every 30 seconds

        // Listen for online status to trigger sync
        const handleOnline = () => {
            syncOrders();
        };

        window.addEventListener('online', handleOnline);
        return () => {
            window.removeEventListener('online', handleOnline);
            clearInterval(interval);
        };
    }, []);

    const syncOrders = async () => {
        if (isSyncing) return;

        const pendingOrders = await db.orders.where('status').equals('pending').toArray();
        if (pendingOrders.length === 0) return;

        setIsSyncing(true);
        toast.loading(`جاري مزامنة ${pendingOrders.length} طلبات...`, { id: 'sync-toast' });

        let successCount = 0;

        for (const offlineOrder of pendingOrders) {
            try {
                // Update status to syncing
                await db.orders.update(offlineOrder.id!, { status: 'syncing' });

                const formData = new FormData();
                formData.append('customerName', offlineOrder.customerName);
                formData.append('customerPhone', offlineOrder.customerPhone);
                formData.append('description', offlineOrder.description);
                formData.append('totalAmount', offlineOrder.totalAmount);
                formData.append('paidAmount', offlineOrder.paidAmount);
                formData.append('dueDate', offlineOrder.dueDate);
                formData.append('factoryId', offlineOrder.factoryId);
                formData.append('shopId', offlineOrder.shopId);

                // Append images
                if (offlineOrder.images && offlineOrder.images.length > 0) {
                    offlineOrder.images.forEach((blob, idx) => {
                        formData.append('images', blob, `image-${idx}.jpg`);
                    });
                }

                const res = await fetch("/api/orders", {
                    method: "POST",
                    body: formData,
                });

                if (res.ok) {
                    await db.orders.delete(offlineOrder.id!);
                    successCount++;
                } else {
                    await db.orders.update(offlineOrder.id!, { status: 'failed' });
                }
            } catch (error) {
                console.error("Sync failed for order", offlineOrder.id, error);
                await db.orders.update(offlineOrder.id!, { status: 'failed' });
            }
        }

        setIsSyncing(false);
        setPendingCount(pendingOrders.length - successCount);

        if (successCount > 0) {
            toast.success(`تمت مزامنة ${successCount} طلبات بنجاح!`, { id: 'sync-toast' });
        } else {
            toast.error("فشلت المزامنة، سنحاول لاحقاً", { id: 'sync-toast' });
        }
    };

    return (
        <>
            {children}
            {pendingCount > 0 && (
                <div className="fixed bottom-24 left-6 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button
                        onClick={syncOrders}
                        disabled={isSyncing}
                        className="flex items-center gap-3 bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 group hover:scale-105 transition-all"
                    >
                        <div className="relative">
                            <Wifi className={`w-4 h-4 ${isSyncing ? 'animate-pulse text-amber-500' : 'text-green-500'}`} />
                            {isSyncing && (
                                <RefreshCw className="w-4 h-4 absolute inset-0 animate-spin text-amber-500" />
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                                {isSyncing ? 'جاري المزامنة...' : 'طلبات معلقة'}
                            </p>
                            <p className="text-xs font-bold opacity-60 leading-none">
                                {pendingCount} طلبات بانتظار الرفع
                            </p>
                        </div>
                    </button>
                </div>
            )}
        </>
    );
}
