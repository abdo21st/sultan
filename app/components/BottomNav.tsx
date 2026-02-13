"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Bell, User, LayoutDashboard, ChevronUp, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions";
import { useState, useEffect } from "react";

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

    // القائمة تكون مفتوحة في صفحة تسجيل الطلبات، ومغلقة في باقي الصفحات
    const isOrdersNewPage = pathname === "/orders/new";
    const [isOpen, setIsOpen] = useState(isOrdersNewPage);

    // تحديث حالة القائمة عند تغيير الصفحة
    useEffect(() => {
        setIsOpen(isOrdersNewPage);
    }, [isOrdersNewPage]);

    const tabs = [
        { icon: Home, label: "الرئيسية", href: "/" },
        { icon: Bell, label: "التنبيهات", href: "/admin/alerts" },
        {
            icon: PlusCircle,
            label: "جديد",
            href: "/orders/new",
            primary: true,
            permission: PERMISSIONS.ORDERS_ADD
        },
        {
            icon: LayoutDashboard,
            label: "المعلومات",
            href: "/admin/dashboard",
            permission: PERMISSIONS.DASHBOARD_VIEW
        },
        { icon: User, label: "حسابي", href: "/profile" },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
            {/* شريط السحب */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex justify-center items-center py-2 cursor-pointer active:scale-95 transition-transform"
            >
                <div className="glass-panel rounded-t-2xl px-8 py-1.5 shadow-lg border border-white/50 border-b-0 flex items-center gap-2">
                    {isOpen ? (
                        <ChevronDown className="w-5 h-5 text-primary animate-bounce" />
                    ) : (
                        <ChevronUp className="w-5 h-5 text-primary animate-bounce" />
                    )}
                    <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
                </div>
            </div>

            {/* القائمة السفلية */}
            <div
                className={`transition-all duration-500 ease-in-out ${isOpen
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-full opacity-0'
                    }`}
            >
                <nav className="glass-panel rounded-t-3xl p-4 pb-6 shadow-premium flex items-center justify-around border border-white/50 border-b-0 mx-4">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href;
                        const Icon = tab.icon;

                        // Permission check
                        if (tab.permission && !session?.user?.permissions?.includes(tab.permission as string)) {
                            return null;
                        }

                        if (tab.primary) {
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className="relative -top-3 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-800 text-white flex items-center justify-center shadow-gold transition-transform hover:scale-105 active:scale-90 border-4 border-background"
                                >
                                    <Icon className="w-7 h-7" strokeWidth={2.5} />
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 ${isActive ? "text-primary scale-110" : "text-muted-foreground"
                                    }`}
                            >
                                <Icon className={`w-6 h-6 ${isActive ? "fill-primary/10" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-black uppercase tracking-tight">{tab.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
