
export const PERMISSIONS = {
    // Users
    USERS_VIEW: 'users:view',
    USERS_ADD: 'users:add',
    USERS_EDIT: 'users:edit',
    USERS_DELETE: 'users:delete',

    // Facilities
    FACILITIES_VIEW: 'facilities:view',
    FACILITIES_ADD: 'facilities:add',
    FACILITIES_EDIT: 'facilities:edit',
    FACILITIES_DELETE: 'facilities:delete',

    // Orders
    ORDERS_VIEW: 'orders:view',
    ORDERS_ADD: 'orders:add',
    ORDERS_EDIT: 'orders:edit',
    ORDERS_DELETE: 'orders:delete',

    // Order Specifics
    ORDERS_CHANGE_STATUS: 'orders:change_status',
    ORDERS_VIEW_FINANCIALS: 'orders:view_financials', // See price/totals

    // Transactions
    TRANSACTIONS_VIEW: 'transactions:view',
    TRANSACTIONS_ADD: 'transactions:add',

    // Roles (Admin)
    ROLES_MANAGE: 'roles:manage',
    SETTINGS_MANAGE: 'settings:manage',
    ALERTS_MANAGE: 'alerts:manage',
    BOOKING_MANAGE: 'booking:manage',

    // Status Transitions
    STATUS_DELIVERING_TO_FACTORY: 'orders:status:delivering_to_factory',
    STATUS_PROCESSING: 'orders:status:processing',
    STATUS_SHOP_READY: 'orders:status:shop_ready',
    STATUS_DELIVERING: 'orders:status:delivering',
    STATUS_COMPLETED: 'orders:status:completed',
    STATUS_REVIEW: 'orders:status:review',
} as const;

export const PERMISSION_LABELS: Record<string, string> = {
    [PERMISSIONS.USERS_VIEW]: 'عرض المستخدمين',
    [PERMISSIONS.USERS_ADD]: 'إضافة مستخدمين',
    [PERMISSIONS.USERS_EDIT]: 'تعديل المستخدمين',
    [PERMISSIONS.USERS_DELETE]: 'حذف المستخدمين',

    [PERMISSIONS.FACILITIES_VIEW]: 'عرض المنشآت',
    [PERMISSIONS.FACILITIES_ADD]: 'إضافة منشآت',
    [PERMISSIONS.FACILITIES_EDIT]: 'تعديل المنشآت',
    [PERMISSIONS.FACILITIES_DELETE]: 'حذف المنشآت',

    [PERMISSIONS.ORDERS_VIEW]: 'عرض الطلبات',
    [PERMISSIONS.ORDERS_ADD]: 'إضافة طلبات',
    [PERMISSIONS.ORDERS_EDIT]: 'تعديل الطلبات',
    [PERMISSIONS.ORDERS_DELETE]: 'حذف الطلبات',
    [PERMISSIONS.ORDERS_CHANGE_STATUS]: 'تغيير حالة الطلب',
    [PERMISSIONS.ORDERS_VIEW_FINANCIALS]: 'عرض تفاصيل مالية الطلب',

    [PERMISSIONS.TRANSACTIONS_VIEW]: 'عرض الحركات المالية',
    [PERMISSIONS.TRANSACTIONS_ADD]: 'إضافة حركة مالية',

    [PERMISSIONS.ROLES_MANAGE]: 'إدارة الأدوار والصلاحيات',
    [PERMISSIONS.SETTINGS_MANAGE]: 'إدارة إعدادات النظام',
    [PERMISSIONS.ALERTS_MANAGE]: 'إدارة نظام التنبيهات',
    [PERMISSIONS.BOOKING_MANAGE]: 'إدارة طاقة الحجز',

    [PERMISSIONS.STATUS_DELIVERING_TO_FACTORY]: 'نقل الطلب إلى: قيد التسليم للمصنع',
    [PERMISSIONS.STATUS_PROCESSING]: 'نقل الطلب إلى: قيد التجهيز',
    [PERMISSIONS.STATUS_SHOP_READY]: 'نقل الطلب إلى: قيد التسليم للمحل',
    [PERMISSIONS.STATUS_DELIVERING]: 'نقل الطلب إلى: قيد التوصيل للعميل',
    [PERMISSIONS.STATUS_COMPLETED]: 'نقل الطلب إلى: مكتمل',
    [PERMISSIONS.STATUS_REVIEW]: 'إعادة الطلب للمراجعة',
};

export const DEFAULT_ROLES = {
    ADMIN: [
        ...Object.values(PERMISSIONS)
    ],
    MANAGER: [
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_ADD, PERMISSIONS.ORDERS_EDIT, PERMISSIONS.ORDERS_CHANGE_STATUS, PERMISSIONS.ORDERS_VIEW_FINANCIALS,
        PERMISSIONS.STATUS_DELIVERING_TO_FACTORY, PERMISSIONS.STATUS_PROCESSING, PERMISSIONS.STATUS_SHOP_READY, PERMISSIONS.STATUS_DELIVERING, PERMISSIONS.STATUS_COMPLETED, PERMISSIONS.STATUS_REVIEW,
        PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_ADD,
        PERMISSIONS.FACILITIES_VIEW
    ],
    ACCOUNTANT: [
        PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_VIEW_FINANCIALS,
        PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_ADD
    ],
    USER: [
        PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_ADD
    ]
};
