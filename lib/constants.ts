export const ORDER_STATUS = {
    REGISTERED: 'REGISTERED',
    TRANSFERRED_TO_FACTORY: 'TRANSFERRED_TO_FACTORY',
    PROCESSING: 'PROCESSING',
    TRANSFERRED_TO_SHOP: 'TRANSFERRED_TO_SHOP',
    DELIVERING: 'DELIVERING',
    COMPLETED: 'COMPLETED',
    REVIEW_NEEDED: 'REVIEW_NEEDED',
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    [ORDER_STATUS.REGISTERED]: 'قيد التسجيل',
    [ORDER_STATUS.TRANSFERRED_TO_FACTORY]: 'قيد التحويل للمصنع',
    [ORDER_STATUS.PROCESSING]: 'قيد التجهيز',
    [ORDER_STATUS.TRANSFERRED_TO_SHOP]: 'جاهز للاستلام',
    [ORDER_STATUS.DELIVERING]: 'قيد التسليم',
    [ORDER_STATUS.COMPLETED]: 'مكتمل',
    [ORDER_STATUS.REVIEW_NEEDED]: 'مراجعة مطلوبة',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
    [ORDER_STATUS.REGISTERED]: 'bg-zinc-100 text-zinc-600',
    [ORDER_STATUS.TRANSFERRED_TO_FACTORY]: 'bg-blue-100 text-blue-600',
    [ORDER_STATUS.PROCESSING]: 'bg-amber-100 text-amber-600',
    [ORDER_STATUS.TRANSFERRED_TO_SHOP]: 'bg-indigo-100 text-indigo-600',
    [ORDER_STATUS.DELIVERING]: 'bg-purple-100 text-purple-600',
    [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-600',
    [ORDER_STATUS.REVIEW_NEEDED]: 'bg-red-100 text-red-600',
};

export const FACILITY_TYPE = {
    FACTORY: 'FACTORY',
    SHOP: 'SHOP',
} as const;

export type FacilityType = keyof typeof FACILITY_TYPE;
