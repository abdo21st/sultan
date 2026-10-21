'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BarChart3, List, Menu, Wallet } from 'lucide-react';
import { PERMISSIONS } from '@/lib/permissions';
import { canNavigate, isNavigationActive } from '@/lib/navigation';

export default function BottomNav({ onMore, menuOpen }: { onMore: () => void; menuOpen: boolean }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    if (!session?.user) return null;
    const tabs = [
        { href: '/', label: 'الطلبات', icon: List, permission: PERMISSIONS.ORDERS_VIEW },
        { href: '/transactions', label: 'الماليات', icon: Wallet, permission: PERMISSIONS.TRANSACTIONS_VIEW },
        { href: '/admin/analytics', label: 'التقارير', icon: BarChart3, permission: PERMISSIONS.DASHBOARD_VIEW },
    ].filter(tab => canNavigate(session.user, [tab.permission]));
    return <nav className="app-bottom-nav" aria-label="التنقل السريع" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map(tab => <Link href={tab.href} key={tab.href} aria-current={isNavigationActive(pathname, tab.href) ? 'page' : undefined}><tab.icon size={20} aria-hidden="true" /><span>{tab.label}</span></Link>)}
        <button type="button" onClick={onMore} aria-haspopup="dialog" aria-expanded={menuOpen}><Menu size={20} aria-hidden="true" /><span>المزيد</span></button>
    </nav>;
}
