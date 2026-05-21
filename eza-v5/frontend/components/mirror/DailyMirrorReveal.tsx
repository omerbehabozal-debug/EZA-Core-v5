'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import { MIRROR_REVEAL_MESSAGE } from '@/lib/eza/mirror/copy';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type DailyMirrorRevealProps = {
  className?: string;
};

const ms = standaloneSkin.mirrorSurface;

export default function DailyMirrorReveal({ className }: DailyMirrorRevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section
      className={cn(ms.idleRoot, !reducedMotion && 'eza-mirror-reveal-glow', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex flex-col items-center gap-6">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full bg-violet-100/70 text-violet-600/90',
            !reducedMotion && 'eza-mirror-star-pulse'
          )}
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </div>
        <p className="text-sm font-medium tracking-tight text-stone-700 sm:text-[15px]">
          {MIRROR_REVEAL_MESSAGE}
        </p>
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-violet-100/70" aria-hidden>
          <div
            className={cn(
              'h-full rounded-full bg-violet-400/70',
              !reducedMotion && 'eza-mirror-reveal-progress'
            )}
          />
        </div>
      </div>
    </section>
  );
}
