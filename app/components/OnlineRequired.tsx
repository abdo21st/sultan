"use client";
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OnlineRequired({ children }: { children: React.ReactNode }) {
    const [online, setOnline] = useState(true);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        update();
        window.addEventListener('online', update); window.addEventListener('offline', update);
        return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
    }, []);
    return <>
        <div inert={!online} aria-hidden={!online || undefined}>{children}</div>
        {!online && <div role="alert" className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6 text-center" dir="rtl">
            <div className="max-w-md space-y-4">
                <WifiOff className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
                <h1 className="text-2xl font-bold">يلزم اتصال بالإنترنت</h1>
                <p className="text-muted-foreground">يعمل النظام عبر الإنترنت فقط. سيعود الاستخدام عند استعادة الاتصال، ولن تُرسل أي عملية تلقائياً.</p>
            </div>
        </div>}
    </>;
}
