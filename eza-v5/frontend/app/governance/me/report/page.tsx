'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useSafeModeReport } from '@/hooks/useSafeModeReport';
import { useSafeModeInsight } from '@/hooks/useSafeModeInsight';
import {
  PageHeader,
  MetricCard,
  GovernancePanel,
  InsightCard,
  ReliabilityPill,
  EmptyState,
} from '@/components/eza';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import SafeModeFeedbackBar from '@/components/governance/SafeModeFeedbackBar';
import type { SafeModeReportPeriod } from '@/lib/types/safemode';
import {
  SAFEMODE_DISCLAIMER,
  insightBody,
  pickFeedbackRefs,
  reliabilityBand,
  reliabilityScore,
  trendInterpretation,
} from '@/lib/eza/safemodeDisplay';
import { ezaCopy } from '@/lib/eza/copy';

export default function GovernanceMeReportPage() {
  const [period, setPeriod] = useState<SafeModeReportPeriod>('weekly');
  const { data, error, isLoading } = useSafeModeReport(period);
  const insightSwr = useSafeModeInsight();

  const feedbackRefs = pickFeedbackRefs(data, data?.trend_summary, insightSwr.data);
  const trend = data?.trend_summary;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Link
        href="/governance/me"
        className="inline-flex items-center gap-1 text-sm font-medium text-eza-accent hover:text-eza-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" />
        AI Interaction Overview
      </Link>

      <PageHeader
        title="Haftalık davranışsal rapor"
        description="Dönem özeti — otomatik karar üretilmez."
        actions={
          <select
            className="rounded-lg border border-eza-border bg-eza-surface px-3 py-1.5 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as SafeModeReportPeriod)}
          >
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
            <option value="monthly">Aylık</option>
          </select>
        }
      />

      <p className="rounded-lg border border-eza-border bg-eza-surface-muted px-4 py-3 text-xs text-eza-text-secondary">
        {data?.disclaimer ?? SAFEMODE_DISCLAIMER}
      </p>

      {error ? <GovernanceErrorState error={error} /> : null}
      {isLoading ? <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p> : null}

      {data && !error ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Dönem" value={data.period} />
            <MetricCard label="Örneklem" value={data.sample_count} />
            <MetricCard
              label="Ort. EZA"
              value={data.averages.eza_score != null ? data.averages.eza_score.toFixed(1) : '—'}
            />
            <MetricCard
              label="Ort. hizalama"
              value={
                data.averages.alignment_score != null
                  ? data.averages.alignment_score.toFixed(1)
                  : '—'
              }
            />
          </section>

          <GovernancePanel title="Güvenilirlik ve yorum">
            <div className="flex flex-wrap items-center gap-3">
              <ReliabilityPill
                score={reliabilityScore(data.reliability ?? trend?.reliability)}
                band={reliabilityBand(data.reliability?.level ?? trend?.reliability?.level)}
              />
              <span className="text-sm text-eza-text-secondary">
                Güven: {data.confidence?.toFixed(0) ?? trend?.confidence?.toFixed(0) ?? '—'}
              </span>
              <span
                className={`text-xs font-medium rounded-full px-2 py-0.5 ${
                  data.can_interpret
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {data.can_interpret ? 'Yorumlanabilir' : 'Ön gözlem'}
              </span>
            </div>
            <p className="mt-3 text-sm text-eza-text-secondary">
              Trend yorumu: {trendInterpretation(trend)}
            </p>
          </GovernancePanel>

          <GovernancePanel title="AI Destek Kullanım Yoğunluğu">
            <p className="text-sm text-eza-text-secondary">
              Dönem ortalaması:{' '}
              <span className="font-semibold tabular-nums text-eza-text">
                {data.averages.ai_reliance_signal != null
                  ? data.averages.ai_reliance_signal.toFixed(2)
                  : '—'}
              </span>
            </p>
          </GovernancePanel>

          <GovernancePanel title="Insight özeti">
            {insightSwr.isLoading ? (
              <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p>
            ) : (insightSwr.data?.sample_count ?? 0) < 20 ? (
              <EmptyState
                title="Insight henüz hazır değil"
                description="En az 20 etkileşim sonrası insight oluşur."
              />
            ) : (
              <InsightCard
                severity={insightSwr.data?.generate ? 'notice' : 'info'}
                title="Davranışsal gözlem özeti"
                body={insightBody(insightSwr.data)}
              />
            )}
          </GovernancePanel>

          <GovernancePanel title="Geri bildirim">
            <p className="mb-3 text-xs text-eza-text-muted">
              Kalibrasyon döngüsüne katkı için hızlı geri bildirim verin.
            </p>
            <SafeModeFeedbackBar
              eventId={feedbackRefs.eventId}
              analysisId={feedbackRefs.analysisId}
              metricName={insightSwr.data?.metric}
            />
          </GovernancePanel>
        </>
      ) : null}

      {!isLoading && !data && !error ? (
        <EmptyState title="Rapor verisi yok" description="Bu dönem için kayıt bulunamadı." />
      ) : null}
    </div>
  );
}
