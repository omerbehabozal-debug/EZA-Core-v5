'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import {
  MIRROR_NAV_ARIA,
  MIRROR_PATTERN_ROUTE,
  MIRROR_TAB_PATTERN,
} from '@/lib/eza/mirror/copy';

/** Pattern-only nav — legacy Daily tab removed with light Daily UI. */
export default function MirrorNav() {
  const pathname = usePathname();
  const ms = standaloneSkin.mirrorSurface;
  const active =
    pathname === MIRROR_PATTERN_ROUTE || pathname?.startsWith(`${MIRROR_PATTERN_ROUTE}/`);

  return (
    <nav className={cn(ms.tabList, 'shrink-0')} aria-label={MIRROR_NAV_ARIA}>
      <Link
        href={MIRROR_PATTERN_ROUTE}
        aria-current={active ? 'page' : undefined}
        className={cn(ms.tab, active ? ms.tabActive : ms.tabIdle)}
      >
        {MIRROR_TAB_PATTERN}
      </Link>
    </nav>
  );
}
