import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge tailwind classes safely
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format currency to Libyan Dinar (LYD)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("ar-LY", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount) + " د.ل";
}

/**
 * Format date to Arabic locale
 */
export function formatDate(date: string | Date | number): string {
    return new Date(date).toLocaleDateString("ar-EG", {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Resolve status label and color
 */
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatus } from "./constants";

export function getStatusInfo(status: string) {
    const s = status as OrderStatus;
    return {
        label: ORDER_STATUS_LABELS[s] || status,
        color: ORDER_STATUS_COLORS[s] || "bg-zinc-100 text-zinc-600"
    };
}
