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
    const [position, setPosition] = useState(() => ({
        x: 20,
        y: typeof window !== 'undefined' ? window.innerHeight - 100 : 100
    }));
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const buttonRef = useRef<HTMLDivElement>(null);

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true);
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
            label: "المعلومات",
            href: "/admin/dashboard",
            permission: PERMISSIONS.DASHBOARD_VIEW
        },
        { icon: User, label: "حسابي", href: "/profile" },
    ];

    // Handle drag start
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('a')) return; // Don't drag when clicking links
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('a')) return;
        setIsDragging(true);
        const touch = e.touches[0];
        setDragStart({
            x: touch.clientX - position.x,
            y: touch.clientY - position.y
        });
    };

    // Handle drag move
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;

            // Keep within screen bounds
            const maxX = window.innerWidth - 70;
            const maxY = window.innerHeight - 70;

            setPosition({
                x: Math.max(10, Math.min(newX, maxX)),
                y: Math.max(10, Math.min(newY, maxY))
            });
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDragging) return;

            const touch = e.touches[0];
            const newX = touch.clientX - dragStart.x;
            const newY = touch.clientY - dragStart.y;

            const maxX = window.innerWidth - 70;
            const maxY = window.innerHeight - 70;

            setPosition({
                x: Math.max(10, Math.min(newX, maxX)),
                y: Math.max(10, Math.min(newY, maxY))
            });
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
    }, [isDragging, dragStart]);

    // Don't render on server to avoid hydration mismatch
    if (!mounted) {
        return null;
    }

    return (
        <div className="md:hidden">
            {/* Floating Button */}
            <div
                ref={buttonRef}
                style={{
                    position: 'fixed',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    zIndex: 9999,
                    touchAction: 'none'
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                className={`${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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

                {/* Popup Menu */}
                {isOpen && (
                    <div className="absolute bottom-20 left-0 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-3 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="space-y-2">
                            {tabs.map((tab) => {
                                const isActive = pathname === tab.href;
                                const Icon = tab.icon;

                                // Permission check
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
