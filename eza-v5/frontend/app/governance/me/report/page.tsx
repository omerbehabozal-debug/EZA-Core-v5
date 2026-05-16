'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSafeModeReport } from '@/hooks/useSafeModeReport';
import { useSafeModeInsight } from '@/hooks/useSafeModeInsight';
import GovernanceInteractionReportView from '@/components/governance/GovernanceInteractionReportView';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import { EmptyState } from '@/components/eza';
import type { SafeModeReportPeriod } from '@/lib/types/safemode';
import {
  buildGovernanceReportFromReport,
  emptyGovernanceReportPlaceholder,
} from '@/lib/eza/governanceReportModel';

export default function GovernanceMeReportPage() {
  const [period, setPeriod] = useState<SafeModeReportPeriod>('weekly');
  const { data, error, isLoading } = useSafeModeReport(period);
  const insightSwr = useSafeModeInsight();

  const model = useMemo(() => {
    if (!data) return null;
    return buildGovernanceReportFromReport(data, insightSwr.data);
  }, [data, insightSwr.data]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <GovernanceErrorState error={error} />
      </div>
    );
  }

  if (!isLoading && !data && !error) {
    return (
      <div className="mx-auto max-w-3xl py-16">
        <EmptyState title="Rapor verisi yok" description="Bu dönem için kayıt bulunamadı." />
      </div>
    );
  }

  return (
    <GovernanceInteractionReportView
      model={
        model ?? emptyGovernanceReportPlaceholder()
      }
      loading={isLoading}
      backHref="/governance/me"
      backLabel="← Genel bakış"
      headerActions={
        <select
          className="rounded-lg border border-eza-border bg-eza-surface px-3 py-1.5 text-sm text-eza-text"
          value={period}
          onChange={(e) => setPeriod(e.target.value as SafeModeReportPeriod)}
          aria-label="Rapor dönemi"
        >
          <option value="daily">Günlük</option>
          <option value="weekly">Haftalık</option>
          <option value="monthly">Aylık</option>
        </select>
      }
    />
  );
}
