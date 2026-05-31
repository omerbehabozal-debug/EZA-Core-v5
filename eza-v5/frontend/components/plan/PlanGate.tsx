'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { usePlan } from '@/lib/eza/plan/usePlan';
import PlanLockOverlay from '@/components/plan/PlanLockOverlay';
import UpgradeModal from '@/components/plan/UpgradeModal';

export type PlanGateVariant = 'blur' | 'lock';

export interface PlanGateProps {
  /** Etiket / analitik amaçlı özellik kimliği. */
  feature: string;
  children: ReactNode;
  /**
   * Free kullanıcıya `children` yerine gösterilecek alternatif içerik
   * (ör. Daily Mirror'da Mini Mirror). Verilmezse children blur edilir.
   */
  fallback?: ReactNode;
  variant?: PlanGateVariant;
  /** Blur varyantında overlay başlığı. */
  title?: string;
  /** Blur varyantında overlay açıklaması. */
  description?: string;
  ctaLabel?: string;
  className?: string;
  compactOverlay?: boolean;
}

/**
 * Sprint 1 — tek tip plan kapısı.
 * Daily Mirror, Scene Generate, Share, Export ve Relationship Pattern
 * tarafında yeniden kullanılır. Plus'ta şeffaf geçer.
 */
export default function PlanGate({
  feature,
  children,
  fallback,
  variant = 'blur',
  title,
  description,
  ctaLabel,
  className,
  compactOverlay = false,
}: PlanGateProps) {
  const { isPlus } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (isPlus) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div className={cn('relative isolate', className)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none select-none',
          variant === 'blur'
            ? 'blur-[7px] saturate-[0.8] opacity-75'
            : 'opacity-30'
        )}
      >
        {children}
      </div>

      <PlanLockOverlay
        title={title}
        description={description}
        ctaLabel={ctaLabel}
        compact={compactOverlay}
        onUpgrade={() => setUpgradeOpen(true)}
      />

      <UpgradeModal
        open={upgradeOpen}
        feature={feature}
        onClose={() => setUpgradeOpen(false)}
      />
    </div>
  );
}
