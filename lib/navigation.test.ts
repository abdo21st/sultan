import { canAccessDestination, canNavigate, isNavigationActive, NAVIGATION_GROUPS, pageTitle } from './navigation';
import { PERMISSIONS } from './permissions';

describe('application navigation', () => {
    it('keeps the nine sections in four groups with unique destinations', () => {
        const paths = NAVIGATION_GROUPS.flatMap(group => group.items.map(item => item.href));
        expect(NAVIGATION_GROUPS).toHaveLength(4);
        expect(paths).toHaveLength(9);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it.each(['/', '/orders/new', '/orders/synthetic', '/orders/synthetic/edit'])('highlights orders at %s', pathname => {
        expect(isNavigationActive(pathname, '/')).toBe(true);
    });

    it('does not highlight orders on administration pages', () => {
        expect(isNavigationActive('/admin/users', '/')).toBe(false);
        expect(isNavigationActive('/admin/users-other', '/admin/users')).toBe(false);
    });

    it('shows a section only to an administrator or an actor with its permission', () => {
        expect(canNavigate({ role: 'ADMIN' }, [PERMISSIONS.USERS_VIEW])).toBe(true);
        expect(canNavigate({ role: 'USER', permissions: [] }, [PERMISSIONS.USERS_VIEW])).toBe(false);
        expect(canNavigate({ role: 'USER', permissions: [PERMISSIONS.USERS_VIEW] }, [PERMISSIONS.USERS_VIEW])).toBe(true);
        expect(canAccessDestination({ role: 'USER', permissions: [PERMISSIONS.USERS_VIEW] }, { permissions: [PERMISSIONS.USERS_VIEW], adminOnly: true })).toBe(false);
    });

    it.each([
        ['/orders/new', 'طلب جديد'],
        ['/orders/synthetic/edit', 'تعديل الطلب'],
        ['/orders/synthetic', 'تفاصيل الطلب'],
        ['/profile', 'الملف الشخصي'],
        ['/admin/booking', 'سعة الإنتاج'],
    ])('labels %s correctly', (pathname, title) => {
        expect(pageTitle(pathname)).toBe(title);
    });
});
