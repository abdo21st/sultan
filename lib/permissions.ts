
export const PERMISSIONS = {
    // Users
    USERS_VIEW: 'users:view',
    USERS_ADD: 'users:add',
    USERS_EDIT: 'users:edit',
    USERS_DELETE: 'users:delete',

    // Facilities
    FACILITIES_VIEW: 'facilities:view',
    FACILITIES_VIEW_ALL: 'facilities:view_all',
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
    ORDERS_SHARE: 'orders:share',
    ORDERS_REVOKE_SHARES: 'orders:revoke_shares',
    ORDERS_ADJUSTMENT_REQUEST: 'orders:adjustment:request',
    ORDERS_ADJUSTMENT_APPROVE: 'orders:adjustment:approve',
    ORDERS_REFUND: 'orders:refund',

    // Transactions
    TRANSACTIONS_VIEW: 'transactions:view',
    TRANSACTIONS_ADD: 'transactions:add',
    TRANSACTIONS_REVERSE: 'transactions:reverse',

    // Roles (Admin)
    ROLES_MANAGE: 'roles:manage',
    SETTINGS_MANAGE: 'settings:manage',
    BACKUP_MANAGE: 'data:backup',
    DATA_CLEAR: 'data:clear',
    AUDIT_VIEW: 'audit:view',
    WHATSAPP_SEND: 'whatsapp:send',
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
    STATUS_VIEW_CANCELLED: 'orders:status:view:cancelled',
    STATUS_VIEW_RETURNED: 'orders:status:view:returned',

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
    [PERMISSIONS.FACILITIES_VIEW_ALL]: 'متابعة الطلبات والحركات في جميع المنشآت',
    [PERMISSIONS.FACILITIES_ADD]: 'إضافة منشآت',
    [PERMISSIONS.FACILITIES_EDIT]: 'تعديل المنشآت',
    [PERMISSIONS.FACILITIES_DELETE]: 'حذف المنشآت',

    [PERMISSIONS.ORDERS_VIEW]: 'عرض قائمة الطلبات',
    [PERMISSIONS.ORDERS_ADD]: 'إضافة طلبات جديدة',
    [PERMISSIONS.ORDERS_EDIT]: 'تعديل بيانات الطلب',
    [PERMISSIONS.ORDERS_DELETE]: 'حذف الطلبات',
    [PERMISSIONS.ORDERS_CHANGE_STATUS]: 'تغيير حالة الطلب (عام)',
    [PERMISSIONS.ORDERS_VIEW_FINANCIALS]: 'عرض تفاصيل مالية الطلب',
    [PERMISSIONS.ORDERS_SHARE]: 'إصدار روابط مشاركة الطلب',
    [PERMISSIONS.ORDERS_REVOKE_SHARES]: 'إلغاء روابط مشاركة الطلب',
    [PERMISSIONS.ORDERS_ADJUSTMENT_REQUEST]: 'طلب إلغاء أو مرتجع مع السبب',
    [PERMISSIONS.ORDERS_ADJUSTMENT_APPROVE]: 'مراجعة واعتماد الإلغاء والمرتجعات',
    [PERMISSIONS.ORDERS_REFUND]: 'تسجيل رد المبلغ بعد اعتماد الإلغاء أو المرتجع',

    [PERMISSIONS.TRANSACTIONS_VIEW]: 'عرض الحركات المالية',
    [PERMISSIONS.TRANSACTIONS_ADD]: 'إضافة حركة مالية',
    [PERMISSIONS.TRANSACTIONS_REVERSE]: 'عكس حركة مالية مع حفظ الأصل',

    [PERMISSIONS.ROLES_MANAGE]: 'إدارة الأدوار والصلاحيات',
    [PERMISSIONS.SETTINGS_MANAGE]: 'إدارة إعدادات النظام',
    [PERMISSIONS.BACKUP_MANAGE]: 'إنشاء نسخة احتياطية',
    [PERMISSIONS.DATA_CLEAR]: 'مسح بيانات التشغيل',
    [PERMISSIONS.AUDIT_VIEW]: 'عرض سجل التدقيق',
    [PERMISSIONS.WHATSAPP_SEND]: 'إرسال إشعارات WhatsApp للعملاء',
    [PERMISSIONS.ALERTS_MANAGE]: 'إدارة نظام التنبيهات',
    [PERMISSIONS.BOOKING_MANAGE]: 'إدارة سعة الإنتاج',
    [PERMISSIONS.DASHBOARD_VIEW]: 'عرض التقارير والتحليلات',

    // Status Views Labels
    [PERMISSIONS.STATUS_VIEW_REGISTERED]: 'عرض: مسجّل',
    [PERMISSIONS.STATUS_VIEW_REVIEW]: 'عرض المراجعة — صلاحية قديمة',
    [PERMISSIONS.STATUS_VIEW_DELIVERING_TO_FACTORY]: 'عرض: قيد التسليم للمصنع',
    [PERMISSIONS.STATUS_VIEW_PROCESSING]: 'عرض: قيد التجهيز',
    [PERMISSIONS.STATUS_VIEW_SHOP_READY]: 'عرض: جاهز للاستلام',
    [PERMISSIONS.STATUS_VIEW_DELIVERING]: 'عرض: قيد التوصيل',
    [PERMISSIONS.STATUS_VIEW_COMPLETED]: 'عرض: تم التسليم للعميل',
    [PERMISSIONS.STATUS_VIEW_CANCELLED]: 'عرض: ملغي',
    [PERMISSIONS.STATUS_VIEW_RETURNED]: 'عرض: مرتجع',

    // Status Changes Labels
    [PERMISSIONS.STATUS_CHANGE_REGISTERED]: 'نقل إلى: قيد التسجيل',
    [PERMISSIONS.STATUS_CHANGE_REVIEW]: 'طلب تصحيح بيانات الطلب مع السبب',
    [PERMISSIONS.STATUS_CHANGE_DELIVERING_TO_FACTORY]: 'نقل إلى: قيد التسليم للمصنع',
    [PERMISSIONS.STATUS_CHANGE_PROCESSING]: 'نقل إلى: قيد التجهيز',
    [PERMISSIONS.STATUS_CHANGE_SHOP_READY]: 'إنهاء تجهيز المصنع وإشعار المحل',
    [PERMISSIONS.STATUS_CHANGE_DELIVERING]: 'نقل إلى: قيد التوصيل',
    [PERMISSIONS.STATUS_CHANGE_COMPLETED]: 'تأكيد تسليم الطلب للعميل',
};

export const DEFAULT_ROLES = {
    ADMIN: [
        ...Object.values(PERMISSIONS)
    ],
    MANAGER: [
        PERMISSIONS.ORDERS_SHARE, PERMISSIONS.ORDERS_REVOKE_SHARES,
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.STATUS_VIEW_CANCELLED, PERMISSIONS.STATUS_VIEW_RETURNED,
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
        PERMISSIONS.STATUS_VIEW_CANCELLED, PERMISSIONS.STATUS_VIEW_RETURNED,
        PERMISSIONS.ORDERS_SHARE,
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
