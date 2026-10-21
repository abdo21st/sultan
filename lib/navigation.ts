import { BarChart3, BellRing, Building2, CalendarDays, List, Settings, Users, Wallet, type LucideIcon } from 'lucide-react';
import { PERMISSIONS } from './permissions';

export const NAVIGATION_GROUPS: { label: string; items: { href: string; label: string; icon: LucideIcon; permissions: string[]; adminOnly?: boolean }[] }[] = [
    { label: 'العمل اليومي', items: [
        { href: '/', label: 'الطلبات', icon: List, permissions: [PERMISSIONS.ORDERS_VIEW] },
        { href: '/admin/booking', label: 'سعة الإنتاج', icon: CalendarDays, permissions: [PERMISSIONS.BOOKING_MANAGE] },
        { href: '/admin/alerts', label: 'متابعة الاستحقاقات', icon: BellRing, permissions: [PERMISSIONS.ALERTS_MANAGE] },
    ] },
    { label: 'الماليات', items: [
        { href: '/transactions', label: 'التحصيل والحركات المالية', icon: Wallet, permissions: [PERMISSIONS.TRANSACTIONS_VIEW] },
    ] },
    { label: 'التقارير', items: [
        { href: '/admin/analytics', label: 'التقارير والتحليلات', icon: BarChart3, permissions: [PERMISSIONS.DASHBOARD_VIEW], adminOnly: true },
    ] },
    { label: 'الإدارة', items: [
        { href: '/admin/users', label: 'المستخدمون والصلاحيات', icon: Users, permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE] },
        { href: '/facilities', label: 'المنشآت', icon: Building2, permissions: [PERMISSIONS.FACILITIES_VIEW] },
        { href: '/admin/settings', label: 'الإعدادات', icon: Settings, permissions: [PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.BACKUP_MANAGE, PERMISSIONS.DATA_CLEAR] },
    ] },
];

export function canNavigate(user: { role?: string; permissions?: string[] }, permissions: readonly string[]) {
    return user.role === 'ADMIN' || permissions.some(permission => user.permissions?.includes(permission));
}

export function canAccessDestination(user: { role?: string; permissions?: string[] }, item: { permissions: readonly string[]; adminOnly?: boolean }) {
    return (!item.adminOnly || user.role === 'ADMIN') && canNavigate(user, item.permissions);
}

export function isNavigationActive(pathname: string, href: string) {
    return href === '/' ? pathname === '/' || pathname.startsWith('/orders/') : pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitle(pathname: string) {
    if (pathname === '/orders/new') return 'طلب جديد';
    if (pathname.startsWith('/orders/')) return pathname.endsWith('/edit') ? 'تعديل الطلب' : 'تفاصيل الطلب';
    if (pathname === '/profile') return 'الملف الشخصي';
    return NAVIGATION_GROUPS.flatMap(group => group.items).find(item => isNavigationActive(pathname, item.href))?.label || 'سلطان';
}

export function roleLabel(role: string) {
    return ({ ADMIN: 'مدير النظام', MANAGER: 'مدير', ACCOUNTANT: 'محاسب', EMPLOYEE: 'موظف', USER: 'مستخدم' } as Record<string, string>)[role] || role;
}
