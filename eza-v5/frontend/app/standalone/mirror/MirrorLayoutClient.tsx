'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';
import { MirrorEntriesProvider } from '@/components/standalone/MirrorEntriesContext';
import PlanHydrator from '@/components/plan/PlanHydrator';

function MirrorPatternProviders({ children }: { children: ReactNode }) {
  return (
    <MirrorEntriesProvider>
      <PlanHydrator />
      {children}
    </MirrorEntriesProvider>
  );
}

/**
 * Pattern uses SAINA shell in page.
 * Legacy `/mirror/daily` redirects in page — do not mount light Daily shell.
 */
export default function MirrorLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPattern =
    pathname === MIRROR_PATTERN_ROUTE || pathname?.startsWith(`${MIRROR_PATTERN_ROUTE}/`);

  if (isPattern) {
    return <MirrorPatternProviders>{children}</MirrorPatternProviders>;
  }

  // Daily (and any other non-pattern mirror path): no light EZA shell.
  return <>{children}</>;
}
