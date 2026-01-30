export const ORDER_STATUS = {
    REGISTERED: 'orders:status:registered',
    DELIVERING_TO_FACTORY: 'orders:status:delivering_to_factory',
    PROCESSING: 'orders:status:processing',
    SHOP_READY: 'orders:status:shop_ready',
    DELIVERING: 'orders:status:delivering',
    COMPLETED: 'orders:status:completed',
    REVIEW: 'orders:status:review',
} as const;

export const ORDER_WORKFLOW: Record<string, string[]> = {
    [ORDER_STATUS.REGISTERED]: [ORDER_STATUS.DELIVERING_TO_FACTORY, ORDER_STATUS.REVIEW],
    [ORDER_STATUS.REVIEW]: [ORDER_STATUS.DELIVERING_TO_FACTORY, ORDER_STATUS.REGISTERED],
    [ORDER_STATUS.DELIVERING_TO_FACTORY]: [ORDER_STATUS.PROCESSING],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHOP_READY],
    [ORDER_STATUS.SHOP_READY]: [ORDER_STATUS.DELIVERING],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.COMPLETED]: [],
};

export type OrderStatus = keyof typeof ORDER_STATUS;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    REGISTERED: 'قيد التسجيل',
    DELIVERING_TO_FACTORY: 'قيد التسليم للمصنع',
    PROCESSING: 'قيد التجهيز',
    SHOP_READY: 'جاهز للمحل',
    DELIVERING: 'قيد التوصيل',
    COMPLETED: 'مكتمل',
    REVIEW: 'قيد المراجعة',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
    REGISTERED: 'bg-zinc-100 text-zinc-600',
    DELIVERING_TO_FACTORY: 'bg-orange-100 text-orange-600',
    PROCESSING: 'bg-amber-100 text-amber-600',
    SHOP_READY: 'bg-indigo-100 text-indigo-600',
    DELIVERING: 'bg-purple-100 text-purple-600',
    COMPLETED: 'bg-green-100 text-green-600',
    REVIEW: 'bg-red-100 text-red-600',
};

export const FACILITY_TYPE = {
    FACTORY: 'FACTORY',
    SHOP: 'SHOP',
} as const;

export type FacilityType = keyof typeof FACILITY_TYPE;

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    [ORDER_STATUS.REGISTERED]: [ORDER_STATUS.DELIVERING_TO_FACTORY, ORDER_STATUS.REVIEW],
    [ORDER_STATUS.REVIEW]: [ORDER_STATUS.DELIVERING_TO_FACTORY, ORDER_STATUS.REGISTERED],
    [ORDER_STATUS.DELIVERING_TO_FACTORY]: [ORDER_STATUS.PROCESSING],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHOP_READY],
    [ORDER_STATUS.SHOP_READY]: [ORDER_STATUS.DELIVERING],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.COMPLETED]: []
};
