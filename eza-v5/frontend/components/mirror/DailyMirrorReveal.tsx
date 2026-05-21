'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MIRROR_REVEAL_MESSAGE } from '@/lib/eza/mirror/copy';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type DailyMirrorRevealProps = {
  className?: string;
};

export default function DailyMirrorReveal({ className }: DailyMirrorRevealProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white via-violet-50/20 to-violet-50/40 px-6 py-14 text-center shadow-[0_16px_48px_-20px_rgba(99,102,241,0.22)] sm:px-10 sm:py-16',
        !reducedMotion && 'eza-mirror-reveal-glow',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute inset-0 eza-mirror-reveal-shimmer opacity-40"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-6">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100/90 text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
            !reducedMotion && 'eza-mirror-star-pulse'
          )}
        >
          <Sparkles className="h-7 w-7" aria-hidden />
        </div>
        <p className="text-base font-medium tracking-tight text-stone-800 sm:text-lg">
          {MIRROR_REVEAL_MESSAGE}
        </p>
        <div
          className="h-1 w-32 overflow-hidden rounded-full bg-violet-100/80"
          aria-hidden
        >
          <div
            className={cn(
              'h-full rounded-full bg-gradient-to-r from-violet-300 via-violet-500 to-violet-300',
              !reducedMotion && 'eza-mirror-reveal-progress'
            )}
          />
        </div>
      </div>
    </section>
  );
}
