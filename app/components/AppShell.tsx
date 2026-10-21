'use client';

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Menu, PanelRightClose, PanelRightOpen, Plus, Search, User } from 'lucide-react';
import { canNavigate, isNavigationActive, NAVIGATION_GROUPS, pageTitle, roleLabel } from '@/lib/navigation';
import { PERMISSIONS } from '@/lib/permissions';
import Notifications from './Notifications';
import BottomNav from './BottomNav';
import Modal from './Modal';

export default function AppShell({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const user = session?.user;
    const [collapsed, setCollapsed] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [branding, setBranding] = useState({ appName: 'سلطان', logoUrl: '', themeColor: '#796453' });
    const standalone = pathname === '/login' || pathname === '/change-password' || /^\/orders\/(share|print)\//.test(pathname) || /\/label$/.test(pathname);
    useEffect(() => {
        if (!user || user.mustChangePassword || standalone) return;
        const abort = new AbortController();
        const load = () => fetch('/api/settings', { signal: abort.signal }).then(res => res.ok ? res.json() : null).then(data => {
            if (data && !abort.signal.aborted) setBranding({ appName: data.appName || 'سلطان', logoUrl: data.logoUrl || '', themeColor: /^#[0-9a-f]{6}$/i.test(data.themeColor) ? data.themeColor : '#796453' });
        }).catch(() => {});
        void load();
        window.addEventListener('sultan:settings-updated', load);
        return () => { abort.abort(); window.removeEventListener('sultan:settings-updated', load); };
    }, [user, standalone]);
    if (!user || user.mustChangePassword || standalone) return children;
    const groups = NAVIGATION_GROUPS.map(group => ({ ...group, items: group.items.filter(item => canNavigate(user, item.permissions)) })).filter(group => group.items.length);
    const links = (compact: boolean) => <nav aria-label="أقسام التطبيق" className="app-navigation">
        {groups.map(group => <section key={group.label} className="app-navigation-group">
            {!compact && <h2 className="app-navigation-label">{group.label}</h2>}
            {group.items.map(item => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-current={isNavigationActive(pathname, item.href) ? 'page' : undefined} aria-label={compact ? item.label : undefined} title={compact ? item.label : undefined} className="app-navigation-link"><item.icon size={20} aria-hidden="true" className="shrink-0" />{!compact && <span>{item.label}</span>}</Link>)}
        </section>)}
    </nav>;
    return <div className="app-shell" data-sidebar-collapsed={collapsed} style={{ '--primary': branding.themeColor, '--color-primary': branding.themeColor } as CSSProperties}>
        <a href="#main-content" className="ui-skip-link">الانتقال إلى المحتوى</a>
        <aside className="app-sidebar">
            <Link href="/" className="app-brand" aria-label={branding.appName}><span className="app-brand-mark">{branding.logoUrl ? <Image src={branding.logoUrl} alt="" width={32} height={32} unoptimized /> : 'س'}</span>{!collapsed && <span>{branding.appName}</span>}</Link>
            {links(collapsed)}
            <footer className="app-sidebar-footer">
                <Link href="/profile" className="app-navigation-link" aria-label={collapsed ? 'الملف الشخصي' : undefined} title={collapsed ? 'الملف الشخصي' : undefined}><User size={20} aria-hidden="true" />{!collapsed && <span className="min-w-0"><span className="block truncate">{user.displayName || user.name || user.username}</span><span className="block text-xs text-muted-foreground">{roleLabel(user.role)}</span></span>}</Link>
                <button type="button" className="app-navigation-link w-full" onClick={() => signOut({ callbackUrl: '/login' })} aria-label={collapsed ? 'تسجيل الخروج' : undefined} title={collapsed ? 'تسجيل الخروج' : undefined}><LogOut size={20} aria-hidden="true" />{!collapsed && <span>تسجيل الخروج</span>}</button>
            </footer>
        </aside>
        <div className="app-workspace">
            <header className="app-header">
                <div className="flex min-w-0 items-center gap-2">
                    <button type="button" className="ui-icon-button lg:hidden" aria-label="فتح القائمة" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={21} aria-hidden="true" /></button>
                    <button type="button" className="ui-icon-button hidden lg:inline-flex" aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{collapsed ? <PanelRightOpen size={20} aria-hidden="true" /> : <PanelRightClose size={20} aria-hidden="true" />}</button>
                    <span className="truncate text-sm font-semibold">{pageTitle(pathname)}</span>
                </div>
                {pathname !== '/' && <form action="/" method="get" className="hidden md:flex items-center gap-2 app-header-search" role="search"><Search size={18} aria-hidden="true" /><input type="search" name="q" aria-label="بحث في الطلبات" placeholder="بحث بالطلب أو العميل أو الهاتف" className="min-w-0 w-full bg-transparent outline-none" /><button type="submit" className="sr-only">بحث</button></form>}
                <div className="flex items-center gap-2 shrink-0">
                    {canNavigate(user, [PERMISSIONS.ORDERS_ADD]) && pathname !== '/orders/new' && <Link href="/orders/new" className="ui-button ui-button-primary"><Plus size={18} aria-hidden="true" /><span>طلب جديد</span></Link>}
                    <Notifications />
                    <Link href="/profile" className="ui-icon-button lg:hidden" aria-label="الملف الشخصي"><User size={20} aria-hidden="true" /></Link>
                </div>
            </header>
            <div id="main-content" tabIndex={-1} className="app-content">{children}</div>
        </div>
        <BottomNav onMore={() => setMenuOpen(true)} menuOpen={menuOpen} />
        <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="القائمة" drawer>
            <div className="app-mobile-brand">{branding.appName}</div>
            {links(false)}
            <div className="border-t border-border pt-3 mt-4"><Link href="/profile" className="app-navigation-link" onClick={() => setMenuOpen(false)}><User size={20} aria-hidden="true" /><span>الملف الشخصي</span></Link><button type="button" className="app-navigation-link w-full" onClick={() => signOut({ callbackUrl: '/login' })}><LogOut size={20} aria-hidden="true" /><span>تسجيل الخروج</span></button></div>
        </Modal>
    </div>;
}
