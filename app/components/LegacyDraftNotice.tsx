"use client";
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/** Old unsent data is never submitted, upgraded, or deleted. */
export default function LegacyDraftNotice() {
    const { data: session } = useSession();
    const allowed = session?.user?.role === 'ADMIN' && !session.user.mustChangePassword;
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!allowed || !('indexedDB' in window)) return;
        let active = true;
        const request = indexedDB.open('SultanAppDB');
        request.onupgradeneeded = () => request.transaction?.abort();
        request.onerror = () => {};
        request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains('orders')) { database.close(); return; }
            const transaction = database.transaction('orders', 'readonly');
            const total = transaction.objectStore('orders').count();
            total.onsuccess = () => { if (active) setCount(total.result); };
            transaction.oncomplete = () => database.close(); transaction.onabort = () => database.close();
        };
        return () => { active = false; };
    }, [allowed]);
    if (!allowed || !count) return null;
    return <p role="status" className="border-b border-border bg-amber-50 p-3 text-center text-sm text-amber-900" dir="rtl">توجد {count} مسودات من النسخة السابقة تحتاج إلى مراجعة الإدارة. لم تُرسل تلقائياً.</p>;
}
