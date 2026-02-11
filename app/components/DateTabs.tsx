'use client';

import { Layers, CalendarDays, Calendar, Clock } from "lucide-react";

export type GroupingMode = 'none' | 'day' | 'week' | 'month';

interface DateTabsProps {
    activeMode: GroupingMode;
    onModeChange: (mode: GroupingMode) => void;
}

export default function DateTabs({ activeMode, onModeChange }: DateTabsProps) {
    const modes = [
        { id: 'none' as const, label: 'قائمة مستمرة', icon: Layers },
        { id: 'day' as const, label: 'فهرسة يومية', icon: Clock },
        { id: 'week' as const, label: 'فهرسة أسبوعية', icon: CalendarDays },
        { id: 'month' as const, label: 'فهرسة شهرية', icon: Calendar },
    ];

    return (
        <div className="flex items-center gap-2 p-1.5 bg-muted/40 backdrop-blur-md rounded-[2rem] border border-border/40 w-fit overflow-x-auto no-scrollbar max-w-full shadow-inner">
            {modes.map((mode) => {
                const Icon = mode.icon;
                const isActive = activeMode === mode.id;

                return (
                    <button
                        key={mode.id}
                        onClick={() => onModeChange(mode.id)}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-[1.5rem] text-sm font-black transition-all duration-500 relative whitespace-nowrap ${isActive
                                ? 'bg-white text-foreground shadow-premium ring-1 ring-border/10 translate-y-[-1px]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/30'
                            }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all duration-500 ${isActive ? 'bg-primary/10 scale-110' : 'bg-transparent'}`}>
                            <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-current'}`} strokeWidth={isActive ? 3 : 2.5} />
                        </div>
                        <span className="antialiased tracking-tight">{mode.label}</span>
                        {isActive && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
