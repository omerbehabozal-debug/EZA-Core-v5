'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useSafeModeTrend } from '@/hooks/useSafeModeTrend';
import { useSafeModeInsight } from '@/hooks/useSafeModeInsight';
import GovernanceInteractionReportView from '@/components/governance/GovernanceInteractionReportView';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import {
  buildGovernanceReportFromTrend,
  emptyGovernanceReportPlaceholder,
} from '@/lib/eza/governanceReportModel';
import { EmptyState } from '@/components/eza';

export default function GovernanceMePage() {
  const trendSwr = useSafeModeTrend();
  const insightSwr = useSafeModeInsight();

  const model = useMemo(() => {
    if (!trendSwr.data) return null;
    return buildGovernanceReportFromTrend(trendSwr.data, insightSwr.data);
  }, [trendSwr.data, insightSwr.data]);

  const error = trendSwr.error || insightSwr.error;
  const loading = trendSwr.isLoading || insightSwr.isLoading;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <GovernanceErrorState error={error} />
      </div>
    );
  }

  if (!loading && !model) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <EmptyState
          title="Henüz gözlem yok"
          description="Etkileşimleriniz kaydedildikçe bu rapor oluşacak."
        />
      </div>
    );
  }

  return (
    <GovernanceInteractionReportView
      model={
        model ?? emptyGovernanceReportPlaceholder()
      }
      loading={loading}
      headerActions={
        <Link
          href="/governance/me/report"
          className="rounded-lg border border-eza-border bg-eza-surface px-3 py-1.5 text-sm font-medium text-eza-text hover:bg-eza-surface-muted"
        >
          Dönem raporu
        </Link>
      }
    />
  );
}
