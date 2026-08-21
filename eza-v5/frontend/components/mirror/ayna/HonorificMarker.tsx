'use client';

import { cn } from '@/lib/utils';
import {
  resolvePublicHonorificId,
  resolvePublicHonorificLabel,
  type PublicHonorificId,
} from '@/lib/eza/mirror/publicHonorific';

type HonorificMarkerProps = {
  honorific?: string | null;
  size?: 'sm' | 'md';
  className?: string;
  testId?: string;
};

/**
 * Quiet public honorific marker — Meraklı / Bilgin.
 * Not a plan badge, achievement ribbon, or ranking signal.
 */
export default function HonorificMarker({
  honorific,
  size = 'md',
  className,
  testId = 'bilign-honorific',
}: HonorificMarkerProps) {
  const id: PublicHonorificId = resolvePublicHonorificId(honorific);
  const label = resolvePublicHonorificLabel(id);
  const markPx = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'bilign-honorific',
        size === 'sm' && 'bilign-honorific--sm',
        id === 'bilgin' && 'bilign-honorific--bilgin',
        className
      )}
      data-testid={testId}
      data-honorific={id}
    >
      <svg
        className="bilign-honorific__mark"
        viewBox="0 0 16 16"
        width={markPx}
        height={markPx}
        fill="none"
        aria-hidden
      >
        <path
          d="M8 1.4 L12.2 3.1 L14.6 7.2 L13.7 11.5 L9.9 14.6 L6.1 14.6 L2.3 11.5 L1.4 7.2 L3.8 3.1 Z"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}
