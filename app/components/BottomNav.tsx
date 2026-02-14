"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Bell, User, LayoutDashboard, Menu, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { PERMISSIONS } from "@/lib/permissions";
import { useState, useEffect, useRef } from "react";

export default function BottomNav() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Use ref for position to avoid re-renders and inline styles
    const position = useRef({
        x: 20,
        y: typeof window !== 'undefined' ? window.innerHeight - 100 : 100
    });

    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const buttonRef = useRef<HTMLDivElement>(null);

    // Prevent hydration mismatch
    useEffect(() => {
        // eslint-disable-next-line
        setMounted(true);
        // Set initial position
        if (buttonRef.current) {
            buttonRef.current.style.transform = `translate(${position.current.x}px, ${position.current.y}px)`;
        }
    }, []);

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
            label: "الإحصائيات",
            href: "/admin/analytics",
            permission: PERMISSIONS.DASHBOARD_VIEW
        },
        { icon: User, label: "حسابي", href: "/profile" },
    ];

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('a')) return;
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.current.x,
            y: e.clientY - position.current.y
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('a')) return;
        setIsDragging(true);
        const touch = e.touches[0];
        dragStart.current = {
            x: touch.clientX - position.current.x,
            y: touch.clientY - position.current.y
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const newX = e.clientX - dragStart.current.x;
            const newY = e.clientY - dragStart.current.y;

            const maxX = window.innerWidth - 70;
            const maxY = window.innerHeight - 70;

            const x = Math.max(10, Math.min(newX, maxX));
            const y = Math.max(10, Math.min(newY, maxY));

            position.current = { x, y };

            if (buttonRef.current) {
                buttonRef.current.style.transform = `translate(${x}px, ${y}px)`;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;

            const touch = e.touches[0];
            const newX = touch.clientX - dragStart.current.x;
            const newY = touch.clientY - dragStart.current.y;

            const maxX = window.innerWidth - 70;
            const maxY = window.innerHeight - 70;

            const x = Math.max(10, Math.min(newX, maxX));
            const y = Math.max(10, Math.min(newY, maxY));

            position.current = { x, y };

            if (buttonRef.current) {
                buttonRef.current.style.transform = `translate(${x}px, ${y}px)`;
            }
        };

        const handleEnd = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleEnd);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleEnd);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleEnd);
        };
    }, [isDragging]);

    if (!mounted) {
        return null;
    }

    return (
        <div className="md:hidden">
            <div
                ref={buttonRef}
                className={`fixed z-[9999] touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <button
                    onClick={(e) => {
                        if (!isDragging) {
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }
                    }}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-amber-800 text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform border-4 border-white/20"
                >
                    {isOpen ? (
                        <X className="w-7 h-7" strokeWidth={2.5} />
                    ) : (
                        <Menu className="w-7 h-7" strokeWidth={2.5} />
                    )}
                </button>

                {isOpen && (
                    <div className="absolute bottom-20 left-0 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-3 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="space-y-2">
                            {tabs.map((tab) => {
                                const isActive = pathname === tab.href;
                                const Icon = tab.icon;

                                if (tab.permission && !session?.user?.permissions?.includes(tab.permission as string)) {
                                    return null;
                                }

                                return (
                                    <Link
                                        key={tab.href}
                                        href={tab.href}
                                        onClick={() => setIsOpen(false)}
                                        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${isActive
                                            ? "bg-gradient-to-r from-primary/10 to-amber-100 text-primary border-2 border-primary/20"
                                            : "hover:bg-gray-100 text-gray-700"
                                            } ${tab.primary ? "bg-gradient-to-r from-primary to-amber-700 text-white hover:from-primary/90 hover:to-amber-600" : ""}`}
                                    >
                                        <Icon className={`w-5 h-5 ${tab.primary ? "text-white" : ""}`} strokeWidth={2.5} />
                                        <span className="text-sm font-bold">{tab.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
