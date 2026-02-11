
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
    DASHBOARD_VIEW: 'dashboard:view', // New permission for control panel access

    // Status Views (Who can SEE this status)
    STATUS_VIEW_REGISTERED: 'orders:status:view:registered',
    STATUS_VIEW_REVIEW: 'orders:status:view:review',
    STATUS_VIEW_DELIVERING_TO_FACTORY: 'orders:status:view:delivering_to_factory',
    STATUS_VIEW_PROCESSING: 'orders:status:view:processing',
    STATUS_VIEW_SHOP_READY: 'orders:status:view:shop_ready',
    STATUS_VIEW_DELIVERING: 'orders:status:view:delivering',
    STATUS_VIEW_COMPLETED: 'orders:status:view:completed',

    // Status Changes (Who can MOVE TO this status)
    STATUS_CHANGE_REGISTERED: 'orders:status:change:registered',
    STATUS_CHANGE_REVIEW: 'orders:status:change:review',
    STATUS_CHANGE_DELIVERING_TO_FACTORY: 'orders:status:change:delivering_to_factory',
    STATUS_CHANGE_PROCESSING: 'orders:status:change:processing',
    STATUS_CHANGE_SHOP_READY: 'orders:status:change:shop_ready',
    STATUS_CHANGE_DELIVERING: 'orders:status:change:delivering',
    STATUS_CHANGE_COMPLETED: 'orders:status:change:completed',
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

    [PERMISSIONS.ORDERS_VIEW]: 'عرض قائمة الطلبات',
    [PERMISSIONS.ORDERS_ADD]: 'إضافة طلبات جديدة',
    [PERMISSIONS.ORDERS_EDIT]: 'تعديل بيانات الطلب',
    [PERMISSIONS.ORDERS_DELETE]: 'حذف الطلبات',
    [PERMISSIONS.ORDERS_CHANGE_STATUS]: 'تغيير حالة الطلب (عام)',
    [PERMISSIONS.ORDERS_VIEW_FINANCIALS]: 'عرض تفاصيل مالية الطلب',

    [PERMISSIONS.TRANSACTIONS_VIEW]: 'عرض الحركات المالية',
    [PERMISSIONS.TRANSACTIONS_ADD]: 'إضافة حركة مالية',

    [PERMISSIONS.ROLES_MANAGE]: 'إدارة الأدوار والصلاحيات',
    [PERMISSIONS.SETTINGS_MANAGE]: 'إدارة إعدادات النظام',
    [PERMISSIONS.ALERTS_MANAGE]: 'إدارة نظام التنبيهات',
    [PERMISSIONS.BOOKING_MANAGE]: 'إدارة طاقة الحجز',
    [PERMISSIONS.DASHBOARD_VIEW]: 'عرض لوحة التحكم',

    // Status Views Labels
    [PERMISSIONS.STATUS_VIEW_REGISTERED]: 'عرض: قيد التسجيل',
    [PERMISSIONS.STATUS_VIEW_REVIEW]: 'عرض: قيد المراجعة',
    [PERMISSIONS.STATUS_VIEW_DELIVERING_TO_FACTORY]: 'عرض: قيد التسليم للمصنع',
    [PERMISSIONS.STATUS_VIEW_PROCESSING]: 'عرض: قيد التجهيز',
    [PERMISSIONS.STATUS_VIEW_SHOP_READY]: 'عرض: جاهز للمحل',
    [PERMISSIONS.STATUS_VIEW_DELIVERING]: 'عرض: قيد التوصيل',
    [PERMISSIONS.STATUS_VIEW_COMPLETED]: 'عرض: مكتمل',

    // Status Changes Labels
    [PERMISSIONS.STATUS_CHANGE_REGISTERED]: 'نقل إلى: قيد التسجيل',
    [PERMISSIONS.STATUS_CHANGE_REVIEW]: 'نقل إلى: قيد المراجعة',
    [PERMISSIONS.STATUS_CHANGE_DELIVERING_TO_FACTORY]: 'نقل إلى: قيد التسليم للمصنع',
    [PERMISSIONS.STATUS_CHANGE_PROCESSING]: 'نقل إلى: قيد التجهيز',
    [PERMISSIONS.STATUS_CHANGE_SHOP_READY]: 'نقل إلى: جاهز للمحل',
    [PERMISSIONS.STATUS_CHANGE_DELIVERING]: 'نقل إلى: قيد التوصيل',
    [PERMISSIONS.STATUS_CHANGE_COMPLETED]: 'نقل إلى: مكتمل',
};

export const DEFAULT_ROLES = {
    ADMIN: [
        ...Object.values(PERMISSIONS)
    ],
    MANAGER: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.USERS_VIEW,
        PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_ADD, PERMISSIONS.ORDERS_EDIT, PERMISSIONS.ORDERS_CHANGE_STATUS, PERMISSIONS.ORDERS_VIEW_FINANCIALS,

        // Manager can see all statuses
        PERMISSIONS.STATUS_VIEW_REGISTERED, PERMISSIONS.STATUS_VIEW_REVIEW, PERMISSIONS.STATUS_VIEW_DELIVERING_TO_FACTORY,
        PERMISSIONS.STATUS_VIEW_PROCESSING, PERMISSIONS.STATUS_VIEW_SHOP_READY, PERMISSIONS.STATUS_VIEW_DELIVERING, PERMISSIONS.STATUS_VIEW_COMPLETED,

        // Manager can change to all statuses
        PERMISSIONS.STATUS_CHANGE_REGISTERED, PERMISSIONS.STATUS_CHANGE_REVIEW, PERMISSIONS.STATUS_CHANGE_DELIVERING_TO_FACTORY,
        PERMISSIONS.STATUS_CHANGE_PROCESSING, PERMISSIONS.STATUS_CHANGE_SHOP_READY, PERMISSIONS.STATUS_CHANGE_DELIVERING, PERMISSIONS.STATUS_CHANGE_COMPLETED,

        PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_ADD,
        PERMISSIONS.FACILITIES_VIEW
    ],
    ACCOUNTANT: [
        PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_VIEW_FINANCIALS,
        PERMISSIONS.TRANSACTIONS_VIEW, PERMISSIONS.TRANSACTIONS_ADD,

        // Accountant can see all statuses (usually) check with logic? For now give all view
        PERMISSIONS.STATUS_VIEW_REGISTERED, PERMISSIONS.STATUS_VIEW_REVIEW, PERMISSIONS.STATUS_VIEW_DELIVERING_TO_FACTORY,
        PERMISSIONS.STATUS_VIEW_PROCESSING, PERMISSIONS.STATUS_VIEW_SHOP_READY, PERMISSIONS.STATUS_VIEW_DELIVERING, PERMISSIONS.STATUS_VIEW_COMPLETED,
    ],
    USER: [
        PERMISSIONS.ORDERS_VIEW,
        // User (e.g. factory worker) might strictly need specific permissions assigned by Admin
        // Keeping it empty of status permissions as requested - Admin must assign.
    ]
};
