'use client';

import { cn } from '@/lib/utils';
import {
  MIRROR_JOURNEY_DECISION_BODY,
  MIRROR_JOURNEY_DECISION_CREATE,
  MIRROR_JOURNEY_DECISION_SKIP,
} from '@/lib/eza/mirror/copy';

export type JourneyWindowDecisionBannerProps = {
  onCreate: () => void;
  onSkip: () => void;
  className?: string;
};

/**
 * Lightweight post-A8 decision — must not block the chat composer.
 */
export default function JourneyWindowDecisionBanner({
  onCreate,
  onSkip,
  className,
}: JourneyWindowDecisionBannerProps) {
  return (
    <div
      className={cn(
        'mx-auto mb-2 w-full max-w-xl rounded-2xl border border-[rgba(231,180,91,0.28)] bg-[rgba(20,18,16,0.92)] px-4 py-3 text-[#f4f0e8] shadow-lg',
        className
      )}
      data-testid="journey-window-decision"
      role="region"
      aria-label={MIRROR_JOURNEY_DECISION_BODY}
    >
      <p className="text-sm font-medium leading-snug">{MIRROR_JOURNEY_DECISION_BODY}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center rounded-full border border-[rgba(231,180,91,0.42)] bg-[linear-gradient(165deg,rgba(231,180,91,0.28)_0%,rgba(231,180,91,0.14)_100%)] px-3 py-2 text-xs font-semibold text-[#f6f0e4]"
          onClick={onCreate}
          data-testid="journey-window-create"
        >
          {MIRROR_JOURNEY_DECISION_CREATE}
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-[rgba(217,196,163,0.88)]"
          onClick={onSkip}
          data-testid="journey-window-skip"
        >
          {MIRROR_JOURNEY_DECISION_SKIP}
        </button>
      </div>
    </div>
  );
}
