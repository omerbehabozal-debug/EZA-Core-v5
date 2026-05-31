'use client';

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PLAN_UPGRADE_BADGE, PLAN_UPGRADE_CTA } from '@/lib/eza/mirror/copy';

export interface PlanLockOverlayProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onUpgrade: () => void;
  className?: string;
  /** Daha kompakt yerleşim (küçük teaser alanları için). */
  compact?: boolean;
}

/** Free kullanıcıya gösterilen kilit + upsell katmanı (PlanGate içinde kullanılır). */
export default function PlanLockOverlay({
  title,
  description,
  ctaLabel = PLAN_UPGRADE_CTA,
  onUpgrade,
  className,
  compact = false,
}: PlanLockOverlayProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center',
        className
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-white/85 text-violet-600 shadow-[0_8px_28px_-10px_rgba(99,102,241,0.5)] backdrop-blur',
          compact ? 'h-9 w-9' : 'h-11 w-11'
        )}
        aria-hidden
      >
        <Lock className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.75} />
      </div>

      {title ? (
        <h3
          className={cn(
            'max-w-xs font-semibold tracking-[-0.02em] text-stone-900',
            compact ? 'text-sm' : 'text-base sm:text-lg'
          )}
        >
          {title}
        </h3>
      ) : null}

      {description ? (
        <p
          className={cn(
            'max-w-xs leading-relaxed text-stone-600',
            compact ? 'text-[12px]' : 'text-sm'
          )}
        >
          {description}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onUpgrade}
        className={cn(
          'mt-1 inline-flex items-center gap-1.5 rounded-full bg-stone-900 font-medium text-white shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)] transition-colors hover:bg-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400',
          compact ? 'px-4 py-2 text-xs' : 'px-6 py-2.5 text-sm'
        )}
      >
        <span className="inline-flex items-center rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {PLAN_UPGRADE_BADGE}
        </span>
        {ctaLabel}
      </button>
    </div>
  );
}
