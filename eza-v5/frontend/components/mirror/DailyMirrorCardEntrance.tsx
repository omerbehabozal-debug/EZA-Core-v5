'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export type DailyMirrorCardEntranceProps = {
  children: ReactNode;
  className?: string;
};

/** Premium card reveal — opacity, scale, slide-up (Sprint 11A). */
export default function DailyMirrorCardEntrance({
  children,
  className,
}: DailyMirrorCardEntranceProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        !reducedMotion && 'eza-mirror-card-enter',
        reducedMotion && 'opacity-100',
        className
      )}
    >
      {children}
    </div>
  );
}
