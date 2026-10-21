'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Menu } from 'lucide-react';
import { canAccessDestination, isNavigationActive, NAVIGATION_GROUPS } from '@/lib/navigation';

export default function BottomNav({ onMore, menuOpen }: { onMore: () => void; menuOpen: boolean }) {
    const { data: session } = useSession();
    const pathname = usePathname();
    if (!session?.user) return null;
    const shortNames: Record<string, string> = { '/': 'الطلبات', '/transactions': 'الماليات', '/admin/analytics': 'التقارير' };
    const tabs = NAVIGATION_GROUPS.flatMap(group => group.items).filter(item => shortNames[item.href] && canAccessDestination(session.user, item));
    return <nav className="app-bottom-nav" aria-label="التنقل السريع" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map(tab => <Link href={tab.href} key={tab.href} aria-current={isNavigationActive(pathname, tab.href) ? 'page' : undefined}><tab.icon size={20} aria-hidden="true" /><span>{shortNames[tab.href]}</span></Link>)}
        <button type="button" onClick={onMore} aria-haspopup="dialog" aria-expanded={menuOpen}><Menu size={20} aria-hidden="true" /><span>المزيد</span></button>
    </nav>;
}
