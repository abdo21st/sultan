export const ORDER_STATUS = {
    REGISTERED: 'orders:status:registered',
    DELIVERING_TO_FACTORY: 'orders:status:delivering_to_factory',
    PROCESSING: 'orders:status:processing',
    SHOP_READY: 'orders:status:shop_ready',
    DELIVERING: 'orders:status:delivering',
    COMPLETED: 'orders:status:completed',
    REVIEW: 'orders:status:review',
    CANCELLED: 'orders:status:cancelled',
    RETURNED: 'orders:status:returned',
} as const;

export const PRIMARY_ORDER_STATUSES = [ORDER_STATUS.REGISTERED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHOP_READY, ORDER_STATUS.COMPLETED] as const;
export const CORRECTION_ALERT_TRIGGER = 'orders:needs_correction';

export const ORDER_WORKFLOW: Record<string, string[]> = {
    // Current Values
    [ORDER_STATUS.REGISTERED]: [ORDER_STATUS.PROCESSING],
    [ORDER_STATUS.REVIEW]: [ORDER_STATUS.PROCESSING],
    [ORDER_STATUS.DELIVERING_TO_FACTORY]: [ORDER_STATUS.PROCESSING],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHOP_READY],
    [ORDER_STATUS.SHOP_READY]: [ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.COMPLETED]: [],

    // Compatibility for Old Database Values (Keep legacy strings as keys)
    'REGISTERED': [ORDER_STATUS.PROCESSING],
    'REVIEW_NEEDED': [ORDER_STATUS.PROCESSING],
    'DELIVERING_TO_FACTORY': [ORDER_STATUS.PROCESSING],
    'PROCESSING': [ORDER_STATUS.SHOP_READY],
    'TRANSFERRED_TO_SHOP': [ORDER_STATUS.COMPLETED],
    'DELIVERING': [ORDER_STATUS.COMPLETED],
    'COMPLETED': [],
};

export type OrderStatus = keyof typeof ORDER_STATUS;

export const ORDER_STATUS_LABELS: Record<string, string> = {
    [ORDER_STATUS.REGISTERED]: 'مسجّل',
    [ORDER_STATUS.DELIVERING_TO_FACTORY]: 'مسجّل',
    [ORDER_STATUS.PROCESSING]: 'قيد التجهيز',
    [ORDER_STATUS.SHOP_READY]: 'جاهز للاستلام',
    [ORDER_STATUS.DELIVERING]: 'جاهز للاستلام',
    [ORDER_STATUS.COMPLETED]: 'تم التسليم للعميل',
    [ORDER_STATUS.REVIEW]: 'يحتاج تصحيحاً',
    [ORDER_STATUS.CANCELLED]: 'ملغي بموافقة المدير',
    [ORDER_STATUS.RETURNED]: 'مرتجع بموافقة المدير',

    // Compatibility
    'REGISTERED': 'مسجّل',
    'DELIVERING_TO_FACTORY': 'مسجّل',
    'PROCESSING': 'قيد التجهيز',
    'TRANSFERRED_TO_SHOP': 'جاهز للاستلام',
    'DELIVERING': 'جاهز للاستلام',
    'COMPLETED': 'تم التسليم للعميل',
    'REVIEW_NEEDED': 'يحتاج تصحيحاً',
    [CORRECTION_ALERT_TRIGGER]: 'يحتاج تصحيحاً',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
    [ORDER_STATUS.REGISTERED]: 'bg-zinc-100 text-zinc-600',
    [ORDER_STATUS.DELIVERING_TO_FACTORY]: 'bg-orange-100 text-orange-600',
    [ORDER_STATUS.PROCESSING]: 'bg-amber-100 text-amber-600',
    [ORDER_STATUS.SHOP_READY]: 'bg-indigo-100 text-indigo-600',
    [ORDER_STATUS.DELIVERING]: 'bg-purple-100 text-purple-600',
    [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-600',
    [ORDER_STATUS.REVIEW]: 'bg-red-100 text-red-600',
    [ORDER_STATUS.CANCELLED]: 'bg-zinc-100 text-zinc-700',
    [ORDER_STATUS.RETURNED]: 'bg-rose-100 text-rose-700',

    // Compatibility
    'REGISTERED': 'bg-zinc-100 text-zinc-600',
    'DELIVERING_TO_FACTORY': 'bg-orange-100 text-orange-600',
    'PROCESSING': 'bg-amber-100 text-amber-600',
    'TRANSFERRED_TO_SHOP': 'bg-indigo-100 text-indigo-600',
    'DELIVERING': 'bg-purple-100 text-purple-600',
    'COMPLETED': 'bg-green-100 text-green-600',
    'REVIEW_NEEDED': 'bg-red-100 text-red-600',
};

export const FACILITY_TYPE = {
    FACTORY: 'FACTORY',
    SHOP: 'SHOP',
} as const;

export const DESTRUCTIVE_CONFIRMATIONS = {
    CLEAR_OPERATIONAL_DATA: "CLEAR_OPERATIONAL_DATA",
    FACTORY_RESET: "RESET_SULTAN_TO_FACTORY_DEFAULTS",
    BULK_DELETE_USERS: "DELETE_OTHER_USERS",
} as const;

export type FacilityType = keyof typeof FACILITY_TYPE;

export const ALLOWED_TRANSITIONS = ORDER_WORKFLOW;

export const LEGACY_STATUS_MAPPING: Record<string, string> = {
    [ORDER_STATUS.REGISTERED]: 'REGISTERED',
    [ORDER_STATUS.DELIVERING_TO_FACTORY]: 'DELIVERING_TO_FACTORY',
    [ORDER_STATUS.PROCESSING]: 'PROCESSING',
    [ORDER_STATUS.SHOP_READY]: 'TRANSFERRED_TO_SHOP',
    [ORDER_STATUS.DELIVERING]: 'DELIVERING',
    [ORDER_STATUS.COMPLETED]: 'COMPLETED',
    [ORDER_STATUS.REVIEW]: 'REVIEW_NEEDED',
    [ORDER_STATUS.CANCELLED]: 'CANCELLED',
    [ORDER_STATUS.RETURNED]: 'RETURNED',
};

export const CLOSED_ORDER_STATUSES: string[] = [ORDER_STATUS.CANCELLED, 'CANCELLED', ORDER_STATUS.RETURNED, 'RETURNED'];

/** Accept old persisted codes while exposing only the four operating stages. */
export function normalizeOrderStatus(status: string): string {
    const canonical = Object.entries(LEGACY_STATUS_MAPPING).find(([, legacy]) => legacy === status)?.[0] ?? status;
    if (canonical === ORDER_STATUS.DELIVERING_TO_FACTORY || canonical === ORDER_STATUS.REVIEW) return ORDER_STATUS.REGISTERED;
    if (canonical === ORDER_STATUS.DELIVERING) return ORDER_STATUS.SHOP_READY;
    return canonical;
}
