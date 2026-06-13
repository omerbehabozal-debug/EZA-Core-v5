'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import { MIRROR_PATTERN_ROUTE } from '@/lib/eza/mirror/copy';
import StandalonePageShell from '@/components/standalone/StandalonePageShell';
import { MirrorEntriesProvider } from '@/components/standalone/MirrorEntriesContext';
import MirrorNav from '@/components/standalone/MirrorNav';
import PlanHydrator from '@/components/plan/PlanHydrator';

const rp = standaloneSkin.reportsPremium;

function MirrorDailyShell({ children }: { children: ReactNode }) {
  return (
    <div className={standaloneSkin.page}>
      <StandalonePageShell>
        <div className={cn(rp.canvas, 'h-full overflow-hidden')}>
          <MirrorEntriesProvider>
            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col overflow-hidden px-4 pb-3 pt-3 sm:px-10 sm:pb-4 sm:pt-4 lg:px-14">
              <div className={rp.ambientLayer} aria-hidden>
                <div className={rp.ambientOrbA} />
                <div className={rp.ambientOrbB} />
                <div className={rp.ambientOrbC} />
              </div>

              <MirrorNav />

              <PlanHydrator />

              <div className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-4">{children}</div>
            </div>
          </MirrorEntriesProvider>
        </div>
      </StandalonePageShell>
    </div>
  );
}

function MirrorPatternProviders({ children }: { children: ReactNode }) {
  return (
    <MirrorEntriesProvider>
      <PlanHydrator />
      {children}
    </MirrorEntriesProvider>
  );
}

/** Daily Mirror legacy shell; pattern route uses SAINA shell in page. */
export default function MirrorLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPattern =
    pathname === MIRROR_PATTERN_ROUTE || pathname?.startsWith(`${MIRROR_PATTERN_ROUTE}/`);

  if (isPattern) {
    return <MirrorPatternProviders>{children}</MirrorPatternProviders>;
  }

  return <MirrorDailyShell>{children}</MirrorDailyShell>;
}
