"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { toast } from "react-hot-toast";
import { Wifi, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";

const MAX_AUTOMATIC_ATTEMPTS = 8;
const STALE_SYNC_MS = 2 * 60 * 1000;

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const canSync = Boolean(session?.user && !session.user.mustChangePassword);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const syncLock = useRef(false);

    const refreshPendingCount = useCallback(async () => {
        try {
            const orders = await db.orders.toArray();
            const now = Date.now();
            const count = orders.filter((order) =>
                order.status === "pending" || order.status === "syncing" || order.status === "failed"
            ).length;
            setPendingCount(count);

            await db.orders.where("status").equals("syncing").filter((order) =>
                !order.syncingAt || now - order.syncingAt > STALE_SYNC_MS
            ).modify({ status: "failed", nextAttemptAt: 0, lastError: "انقطعت المزامنة قبل اكتمالها" });
        } catch (error) {
            console.error("Failed to read offline queue", error);
        }
    }, []);

    const syncOrders = useCallback(async (forceRetry = false) => {
        if (!canSync || syncLock.current || !navigator.onLine) return;
        syncLock.current = true;
        setIsSyncing(true);

        let successCount = 0;
        let failureCount = 0;
        try {
            const now = Date.now();
            const queued = await db.orders.toArray();
            const orders = queued.filter((order) => {
                if (order.status !== "pending" && order.status !== "failed") return false;
                if (forceRetry) return true;
                return order.attempts < MAX_AUTOMATIC_ATTEMPTS && order.nextAttemptAt <= now;
            });
            if (orders.length === 0) return;

            toast.loading(`جاري مزامنة ${orders.length} طلبات...`, { id: "sync-toast" });

            for (const offlineOrder of orders) {
                const nextAttempt = offlineOrder.attempts + 1;
                await db.orders.update(offlineOrder.id!, {
                    status: "syncing",
                    attempts: nextAttempt,
                    syncingAt: Date.now(),
                });

                try {
                    const formData = new FormData();
                    formData.append("customerName", offlineOrder.customerName);
                    formData.append("customerPhone", offlineOrder.customerPhone);
                    formData.append("description", offlineOrder.description);
                    formData.append("totalAmount", offlineOrder.totalAmount);
                    formData.append("paidAmount", offlineOrder.paidAmount);
                    formData.append("dueDate", offlineOrder.dueDate);
                    formData.append("factoryId", offlineOrder.factoryId);
                    formData.append("shopId", offlineOrder.shopId);
                    formData.append("clientRequestId", offlineOrder.idempotencyKey);

                    offlineOrder.images.forEach((image, index) => {
                        formData.append("images", image, `image-${index}.jpg`);
                    });

                    const response = await fetch("/api/orders", { method: "POST", body: formData });
                    if (response.ok) {
                        await db.orders.delete(offlineOrder.id!);
                        successCount++;
                        continue;
                    }

                    let message = "تعذرت مزامنة الطلب";
                    try {
                        const responseBody = await response.json() as { error?: string };
                        message = responseBody.error || message;
                    } catch { /* Preserve the generic message for non-JSON responses. */ }

                    const retryable = response.status >= 500 || response.status === 429;
                    const delayMs = Math.min(5000 * (2 ** Math.min(nextAttempt - 1, 8)), 15 * 60 * 1000);
                    await db.orders.update(offlineOrder.id!, {
                        status: "failed",
                        syncingAt: undefined,
                        nextAttemptAt: retryable && nextAttempt < MAX_AUTOMATIC_ATTEMPTS
                            ? Date.now() + delayMs
                            : Number.MAX_SAFE_INTEGER,
                        lastError: message,
                    });
                    failureCount++;
                } catch (error) {
                    const delayMs = Math.min(5000 * (2 ** Math.min(nextAttempt - 1, 8)), 15 * 60 * 1000);
                    await db.orders.update(offlineOrder.id!, {
                        status: "failed",
                        syncingAt: undefined,
                        nextAttemptAt: nextAttempt < MAX_AUTOMATIC_ATTEMPTS
                            ? Date.now() + delayMs
                            : Number.MAX_SAFE_INTEGER,
                        lastError: error instanceof Error ? error.message : "تعذر الاتصال بالخادم",
                    });
                    failureCount++;
                }
            }

            if (successCount > 0 && failureCount === 0) {
                toast.success(`تمت مزامنة ${successCount} طلبات بنجاح`, { id: "sync-toast" });
            } else if (successCount > 0) {
                toast.success(`تمت مزامنة ${successCount} طلبات؛ بقيت ${failureCount} للمراجعة`, { id: "sync-toast" });
            } else if (failureCount > 0) {
                toast.error("تعذرت مزامنة بعض الطلبات. ستتم إعادة المحاولة أو يمكنك المحاولة الآن.", { id: "sync-toast" });
            }
        } finally {
            syncLock.current = false;
            setIsSyncing(false);
            await refreshPendingCount();
        }
    }, [canSync, refreshPendingCount]);

    useEffect(() => {
        if (!canSync) return;
        const onOnline = () => { void syncOrders(); };
        const onQueueUpdated = () => { void refreshPendingCount(); };
        void refreshPendingCount().then(() => {
            if (navigator.onLine) void syncOrders();
        });
        const interval = setInterval(() => {
            void refreshPendingCount();
            if (navigator.onLine) void syncOrders();
        }, 30000);
        window.addEventListener("online", onOnline);
        window.addEventListener("sultan:offline-queue-updated", onQueueUpdated);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("sultan:offline-queue-updated", onQueueUpdated);
            clearInterval(interval);
        };
    }, [canSync, refreshPendingCount, syncOrders]);

    return (
        <>
            {children}
            {canSync && pendingCount > 0 && (
                <div className="fixed bottom-24 left-6 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <button
                        onClick={() => { void syncOrders(true); }}
                        disabled={isSyncing}
                        className="flex items-center gap-3 bg-zinc-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/10 group hover:scale-105 transition-all"
                    >
                        <div className="relative">
                            <Wifi className={`w-4 h-4 ${isSyncing ? "animate-pulse text-amber-500" : "text-green-500"}`} />
                            {isSyncing && <RefreshCw className="w-4 h-4 absolute inset-0 animate-spin text-amber-500" />}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                                {isSyncing ? "جاري المزامنة..." : "طلبات بانتظار المزامنة"}
                            </p>
                            <p className="text-xs font-bold opacity-60 leading-none">{pendingCount} طلبات محفوظة محلياً</p>
                        </div>
                    </button>
                </div>
            )}
        </>
    );
}
