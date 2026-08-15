'use client';

/**
 * Phase 6.2 / 6.2.1 — quiet public social proof.
 * Landing/chain fetch /metrics. Feed/profile pass projected counts (no fetch).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  fetchYansiPublicMetrics,
  isYansiPublicMetrics,
  yansiMetricsMatchPresentedVersion,
  type YansiPublicMetrics,
} from '@/lib/eza/mirror-network/yansiPublicMetrics';
import {
  formatYansiPublicSocialProof,
  parseYansiPublicSocialProofInput,
} from '@/lib/eza/mirror-network/yansiPublicMetricsCopy';

export type YansiPublicMetricsViewProps = {
  experienceStartedCount: number;
  directChildYansiCount: number;
  className?: string;
  variant?: 'card' | 'section';
  slug?: string;
  journeyVersion?: number;
};

export function YansiPublicMetricsView({
  experienceStartedCount,
  directChildYansiCount,
  className,
  variant = 'section',
  slug,
  journeyVersion,
}: YansiPublicMetricsViewProps) {
  const copy = formatYansiPublicSocialProof({
    experienceStartedCount,
    directChildYansiCount,
  });
  if (!copy) return null;

  return (
    <p
      className={cn(
        variant === 'card'
          ? 'saina-discover-card__yansi saina-mirror-public-card__meta'
          : 'text-[11px] font-medium tracking-wide text-[rgba(201,187,168,0.62)]',
        className
      )}
      data-testid="yansi-public-metrics"
      data-metrics-slug={slug ? slug.trim().toLowerCase() : undefined}
      data-metrics-version={
        typeof journeyVersion === 'number' ? String(journeyVersion) : undefined
      }
      aria-label={copy.sr}
    >
      {copy.visible}
    </p>
  );
}

export type YansiPublicMetricsLineProps = {
  slug: string;
  journeyVersion: number;
  className?: string;
  /** card = landing public card; section = chain identity header */
  variant?: 'card' | 'section';
};

export default function YansiPublicMetricsLine({
  slug,
  journeyVersion,
  className,
  variant = 'section',
}: YansiPublicMetricsLineProps) {
  const [metrics, setMetrics] = useState<YansiPublicMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchYansiPublicMetrics(slug, journeyVersion).then((result) => {
      if (cancelled) return;
      if (
        !result.ok ||
        !isYansiPublicMetrics(result.data) ||
        !yansiMetricsMatchPresentedVersion(result.data, slug, journeyVersion)
      ) {
        setMetrics(null);
        return;
      }
      setMetrics(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, journeyVersion]);

  const parsed = metrics ? parseYansiPublicSocialProofInput(metrics) : null;
  if (!parsed) return null;

  return (
    <YansiPublicMetricsView
      experienceStartedCount={parsed.experienceStartedCount}
      directChildYansiCount={parsed.directChildYansiCount}
      className={className}
      variant={variant}
      slug={slug}
      journeyVersion={journeyVersion}
    />
  );
}
