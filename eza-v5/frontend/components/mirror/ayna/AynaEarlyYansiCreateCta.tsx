'use client';

import { cn } from '@/lib/utils';
import {
  MIRROR_AYNA_EARLY_CREATE_HINT,
  MIRROR_JOURNEY_DECISION_CREATE,
} from '@/lib/eza/mirror/copy';

export type AynaEarlyYansiCreateCtaProps = {
  onCreate: () => void;
  /** Full empty-state stack vs compact strip when reel already has artifacts. */
  variant?: 'empty' | 'compact';
  showHint?: boolean;
  className?: string;
};

/**
 * Early (6–7) Yansı create affordance for authenticated Journey Ayna.
 * Opens Review via parent callback — never generates directly.
 */
export default function AynaEarlyYansiCreateCta({
  onCreate,
  variant = 'empty',
  showHint = variant === 'empty',
  className,
}: AynaEarlyYansiCreateCtaProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        variant === 'empty' ? 'gap-2 px-3 py-8' : 'gap-1.5 px-3 py-3',
        className
      )}
      data-testid="ayna-early-yansi-create"
      data-variant={variant}
    >
      {showHint ? (
        <p className="text-[11px] leading-relaxed text-[rgba(217,196,163,0.75)]">
          {MIRROR_AYNA_EARLY_CREATE_HINT}
        </p>
      ) : null}
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-[rgba(231,180,91,0.42)] bg-[linear-gradient(165deg,rgba(231,180,91,0.28)_0%,rgba(231,180,91,0.14)_100%)] px-4 py-2 text-xs font-semibold text-[#f6f0e4]"
        onClick={onCreate}
        data-testid="ayna-early-yansi-create-button"
      >
        {MIRROR_JOURNEY_DECISION_CREATE}
      </button>
    </div>
  );
}
