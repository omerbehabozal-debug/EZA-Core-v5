'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  MIRROR_DAILY_ROUTE,
  MIRROR_NAV_ARIA,
  MIRROR_PATTERN_ROUTE,
  MIRROR_TAB_DAILY,
  MIRROR_TAB_PATTERN,
} from '@/lib/eza/mirror/copy';

const ITEMS = [
  { href: MIRROR_DAILY_ROUTE, label: MIRROR_TAB_DAILY },
  { href: MIRROR_PATTERN_ROUTE, label: MIRROR_TAB_PATTERN },
] as const;

/** Ayna üst navigasyonu — deep-link'lenebilir route linkleri (sekme yerine). */
export default function MirrorNav() {
  const pathname = usePathname();
  const ms = standaloneSkin.mirrorSurface;

  return (
    <nav className={cn(ms.tabList, 'shrink-0')} aria-label={MIRROR_NAV_ARIA}>
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(ms.tab, active ? ms.tabActive : ms.tabIdle)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
