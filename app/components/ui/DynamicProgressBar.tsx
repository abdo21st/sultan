"use client";

import React from "react";

interface DynamicProgressBarProps {
    value: number;
    max: number;
    colorClass?: string;
}

export default function DynamicProgressBar({ value, max, colorClass = "bg-primary" }: DynamicProgressBarProps) {
    const percentage = Math.min(100, (value / max) * 100);

    return (
        <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
            <div
                className={`h-full ${colorClass} rounded-full transition-all duration-1000 progress-bar-fill`}
                data-width={percentage}
            >
                <style jsx>{`
                    .progress-bar-fill {
                        width: ${percentage}%;
                    }
                `}</style>
            </div>
        </div>
    );
}
