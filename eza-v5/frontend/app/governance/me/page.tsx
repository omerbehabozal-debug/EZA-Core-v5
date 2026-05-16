'use client';

import Link from 'next/link';
import { useSafeModeTrend } from '@/hooks/useSafeModeTrend';
import { useSafeModeInsight } from '@/hooks/useSafeModeInsight';
import {
  PageHeader,
  MetricCard,
  TrendChart,
  InsightCard,
  ReliabilityPill,
  EmptyState,
  GovernancePanel,
} from '@/components/eza';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import SafeModeFeedbackBar from '@/components/governance/SafeModeFeedbackBar';
import {
  SAFEMODE_DISCLAIMER,
  averageEzaScore,
  insightBody,
  pickFeedbackRefs,
  reliabilityBand,
  reliabilityScore,
  trendChartFromEza,
  trendInterpretation,
} from '@/lib/eza/safemodeDisplay';
import { ezaCopy } from '@/lib/eza/copy';

export default function GovernanceMePage() {
  const trendSwr = useSafeModeTrend();
  const insightSwr = useSafeModeInsight();

  const trend = trendSwr.data;
  const insight = insightSwr.data;
  const error = trendSwr.error || insightSwr.error;
  const loading = trendSwr.isLoading || insightSwr.isLoading;

  const feedbackRefs = pickFeedbackRefs(trend, insight);
  const chartPoints = trendChartFromEza(trend);
  const relBand = reliabilityBand(trend?.reliability?.level);
  const relScore = reliabilityScore(trend?.reliability);

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
      <PageHeader
        title="AI Interaction Overview"
        description="Davranışsal gözlem — AI etkileşim dengesi ve kalibrasyon sinyalleri."
        actions={
          <Link
            href="/governance/me/report"
            className="rounded-lg border border-eza-border bg-eza-surface px-3 py-1.5 text-sm font-medium text-eza-text hover:bg-eza-surface-muted"
          >
            Haftalık rapor
          </Link>
        }
      />

      <p className="rounded-lg border border-eza-border bg-eza-accent-muted/50 px-4 py-3 text-xs text-eza-text-secondary">
        {SAFEMODE_DISCLAIMER}
      </p>

      {error ? <GovernanceErrorState error={error} /> : null}
      {loading ? <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p> : null}

      {trend && !error ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="EZA skor (EMA)" value={averageEzaScore(trend)} />
            <MetricCard
              label="Güvenilirlik"
              value={trend.reliability?.level ?? '—'}
              hint="Davranışsal gözlem kalitesi"
            />
            <MetricCard
              label="Güven"
              value={trend.confidence != null ? trend.confidence.toFixed(0) : '—'}
            />
            <MetricCard label="Örneklem" value={trend.sample_count} />
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <ReliabilityPill score={relScore} band={relBand} />
            <span className="text-xs text-eza-text-muted">
              AI Destek Kullanım Yoğunluğu —{' '}
              {trend.metrics?.ai_reliance_trend?.label ?? 'gözlem'}
            </span>
          </div>

          <GovernancePanel title="AI Etkileşim Dengesi (EZA skor trendi)">
            {!trend.can_trend || chartPoints.length < 3 ? (
              <EmptyState
                title="Trend henüz oluşmadı"
                description="En az 5 etkileşim sonrası trend oluşur."
              />
            ) : (
              <>
                <TrendChart
                  data={chartPoints}
                  valueLabel="EZA skor"
                  title={trendInterpretation(trend)}
                />
                <p className="mt-2 text-xs text-eza-text-muted">
                  {trend.metrics?.ai_reliance_trend?.trend?.interpretation
                    ? `AI destek eğilimi: ${trend.metrics.ai_reliance_trend.trend.interpretation}`
                    : null}
                </p>
              </>
            )}
          </GovernancePanel>

          <GovernancePanel title="Davranışsal gözlem (VayBe)">
            {insightSwr.isLoading ? (
              <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p>
            ) : insight && (insight.sample_count ?? 0) < 20 ? (
              <EmptyState
                title="Insight henüz hazır değil"
                description="En az 20 etkileşim sonrası insight oluşur."
              />
            ) : (
              <InsightCard
                severity={insight?.generate ? 'notice' : 'info'}
                title={
                  insight?.display_name
                    ? `Kalibrasyon sinyali — ${insight.display_name}`
                    : 'Davranışsal gözlem'
                }
                body={insightBody(insight)}
                footer={
                  insight?.can_interpret ? (
                    <span className="text-xs text-eza-text-muted">
                      Güven: {insight.confidence?.toFixed(0) ?? '—'} · Yorumlanabilir
                    </span>
                  ) : (
                    <span className="text-xs text-eza-text-muted">Ön gözlem — kesin yorum için daha fazla veri</span>
                  )
                }
              />
            )}
          </GovernancePanel>

          <GovernancePanel title="Kalibrasyon">
            <SafeModeFeedbackBar
              eventId={feedbackRefs.eventId}
              analysisId={feedbackRefs.analysisId}
              metricName={insight?.metric}
            />
          </GovernancePanel>
        </>
      ) : null}

      {!loading && !trend && !error ? (
        <EmptyState
          title="Henüz gözlem yok"
          description="Etkileşimleriniz kaydedildikçe bu panel dolacak."
        />
      ) : null}
    </div>
  );
}
