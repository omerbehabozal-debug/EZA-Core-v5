'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import StandalonePageShell from '@/components/standalone/StandalonePageShell';
import { MirrorEntriesProvider } from '@/components/standalone/MirrorEntriesContext';
import MirrorNav from '@/components/standalone/MirrorNav';

const rp = standaloneSkin.reportsPremium;

/**
 * Ayna ortak kabuğu: kenar çubuğu + canvas + üst navigasyon + paylaşılan veri.
 * Alt görünümler (Günlük / İlişki) ayrı route olarak burada render edilir.
 */
export default function MirrorLayout({ children }: { children: ReactNode }) {
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

              <div className="mt-3 flex min-h-0 flex-1 flex-col sm:mt-4">{children}</div>
            </div>
          </MirrorEntriesProvider>
        </div>
      </StandalonePageShell>
    </div>
  );
}
