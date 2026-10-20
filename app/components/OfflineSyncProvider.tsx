"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db, facilityDb } from "@/lib/db";
import { toast } from "react-hot-toast";
import { Wifi, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const MAX_AUTOMATIC_ATTEMPTS = 8;
const STALE_SYNC_MS = 2 * 60 * 1000;
const SESSION_EXPIRED_MESSAGE = "انتهت جلسة الدخول. طلباتك وصورها ما زالت محفوظة على هذا الجهاز.";

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status: sessionStatus } = useSession();
    const canSync = Boolean(session?.user && !session.user.mustChangePassword);
    const [isSyncing, setIsSyncing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [failure, setFailure] = useState<{ count: number; message: string; sessionExpired: boolean } | null>(null);
    const syncLock = useRef(false);

    const refreshPendingCount = useCallback(async () => {
        try {
            const now = Date.now();
            await db.orders.where("status").equals("syncing").filter((order) =>
                !order.syncingAt || now - order.syncingAt > STALE_SYNC_MS
            ).modify({ status: "failed", nextAttemptAt: 0, lastError: "انقطعت المزامنة قبل اكتمالها", lastStatus: undefined });
            const orders = await db.orders.toArray();
            const count = orders.filter((order) =>
                order.status === "pending" || order.status === "syncing" || order.status === "failed"
            ).length;
            setPendingCount(count);
            const failed = orders.filter((order) => order.status === "failed");
            const sessionExpired = failed.some((order) => order.lastStatus === 401);
            setFailure(failed.length ? {
                count: failed.length,
                message: sessionExpired ? SESSION_EXPIRED_MESSAGE : failed.at(-1)?.lastError || "تعذرت مزامنة الطلب",
                sessionExpired,
            } : null);
        } catch (error) {
            console.error("Failed to read offline queue", { errorType: error instanceof Error ? error.name : "UnknownError" });
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
            if (!forceRetry && queued.some((order) => order.lastStatus === 401)) return;
            const orders = queued.filter((order) => {
                if (order.status !== "pending" && order.status !== "failed") return false;
                if (forceRetry) return true;
                if (order.lastStatus === 401) return false;
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
                    if (response.status === 401) message = SESSION_EXPIRED_MESSAGE;

                    const retryable = response.status >= 500 || response.status === 429;
                    const delayMs = Math.min(5000 * (2 ** Math.min(nextAttempt - 1, 8)), 15 * 60 * 1000);
                    await db.orders.update(offlineOrder.id!, {
                        status: "failed",
                        syncingAt: undefined,
                        nextAttemptAt: retryable && nextAttempt < MAX_AUTOMATIC_ATTEMPTS
                            ? Date.now() + delayMs
                            : Number.MAX_SAFE_INTEGER,
                        lastError: message,
                        lastStatus: response.status,
                    });
                    failureCount++;
                    // Preserve the remaining queue until the user signs in again.
                    if (response.status === 401) break;
                } catch (error) {
                    const delayMs = Math.min(5000 * (2 ** Math.min(nextAttempt - 1, 8)), 15 * 60 * 1000);
                    await db.orders.update(offlineOrder.id!, {
                        status: "failed",
                        syncingAt: undefined,
                        nextAttemptAt: nextAttempt < MAX_AUTOMATIC_ATTEMPTS
                            ? Date.now() + delayMs
                            : Number.MAX_SAFE_INTEGER,
                        lastError: "تعذر الاتصال بالخادم. الطلب وصوره محفوظة ويمكن إعادة المحاولة.",
                        lastStatus: undefined,
                    });
                    console.error("Offline synchronization connection failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
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
        if (sessionStatus === "unauthenticated" || session?.user.mustChangePassword) {
            void facilityDb.facilityCache.clear().catch(() => {
                console.error("Failed to clear offline facility cache");
            });
        }
    }, [sessionStatus, session?.user.mustChangePassword]);

    useEffect(() => {
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
            {pendingCount > 0 && (
                <div dir="rtl" className="fixed bottom-24 left-4 right-4 sm:right-auto sm:left-6 sm:w-96 z-[100] rounded-2xl border border-white/10 bg-zinc-900 text-white p-4 shadow-2xl">
                    <div className="flex items-center gap-3">
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
                    </div>
                    {session?.user.mustChangePassword ? (
                        <Link href="/change-password" className="mt-3 flex min-h-11 items-center font-bold text-amber-300 underline">غيّر كلمة المرور لمتابعة المزامنة</Link>
                    ) : sessionStatus !== "loading" && (!canSync || failure?.sessionExpired) ? (
                        <div className="mt-3 text-sm" role="alert">
                            <p>{SESSION_EXPIRED_MESSAGE}</p>
                            <Link href="/login" className="flex min-h-11 items-center font-bold text-amber-300 underline">تسجيل الدخول لمتابعة المزامنة</Link>
                        </div>
                    ) : null}
                    {canSync && failure && !failure.sessionExpired && (
                        <div role="alert" className="mt-3 text-sm text-amber-200">
                            <p>{failure.count} طلبات تحتاج إلى إعادة المحاولة</p>
                            <p className="mt-1 break-words">{failure.message}</p>
                        </div>
                    )}
                    {canSync && (
                        <button onClick={() => { void syncOrders(true); }} disabled={isSyncing}
                            className="mt-3 min-h-11 w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-50">
                            {isSyncing ? "جاري المزامنة..." : failure ? "إعادة المحاولة" : "المزامنة الآن"}
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
