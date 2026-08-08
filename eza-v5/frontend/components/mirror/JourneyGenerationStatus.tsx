'use client';

import { cn } from '@/lib/utils';
import {
  MIRROR_JOURNEY_STATUS_GENERATING,
  MIRROR_JOURNEY_STATUS_READY,
} from '@/lib/eza/mirror/copy';

export type JourneyGenerationStatusProps = {
  status: 'generating' | 'ready';
  className?: string;
};

export default function JourneyGenerationStatus({
  status,
  className,
}: JourneyGenerationStatusProps) {
  return (
    <p
      className={cn(
        'mx-auto mb-1 w-full max-w-xl px-1 text-[11px] text-[rgba(217,196,163,0.7)]',
        className
      )}
      data-testid={`journey-gen-status-${status}`}
    >
      {status === 'generating'
        ? MIRROR_JOURNEY_STATUS_GENERATING
        : MIRROR_JOURNEY_STATUS_READY}
    </p>
  );
}
