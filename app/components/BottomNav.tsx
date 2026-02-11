"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Bell, User, LayoutDashboard } from "lucide-react";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions";

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();

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
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
            <nav className="glass-panel rounded-3xl p-2 shadow-premium flex items-center justify-around border border-white/50">
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
    );
}
