'use client';

import Link from 'next/link';
import { useOrganization } from '@/context/OrganizationContext';
import { useGovernanceOverview } from '@/hooks/useGovernanceOverview';
import { useWeeklyCalibrationReport } from '@/hooks/useWeeklyCalibrationReport';
import {
  PageHeader,
  MetricCard,
  GovernancePanel,
  InsightCard,
  EmptyState,
} from '@/components/eza';
import DistributionBarChart from '@/components/governance/DistributionBarChart';
import DoNotAutoApplyBanner from '@/components/governance/DoNotAutoApplyBanner';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import { ezaCopy } from '@/lib/eza/copy';

export default function GovernanceOverviewPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  const { data, error, isLoading } = useGovernanceOverview(orgId);
  const weekly = useWeeklyCalibrationReport(orgId, 1);

  if (!orgId) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Governance" description={ezaCopy.tagline} />
        <div className="mt-6">
          <EmptyState
            title="Organizasyon seçin"
            description="Üst çubuktan bir organizasyon seçerek governance verilerini görüntüleyin."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
      <PageHeader
        title="Governance genel bakış"
        description="Son 30 gün — sayısal özetler ve kalibrasyon gözlemleri."
        actions={
          <Link
            href="/admin/governance/events"
            className="rounded-lg bg-eza-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-eza-accent-hover"
          >
            Olayları görüntüle
          </Link>
        }
      />

      {error ? <GovernanceErrorState error={error} /> : null}

      {isLoading ? (
        <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p>
      ) : null}

      {data && !error ? (
        <>
          {!data.tables_ready ? (
            <InsightCard
              severity="caution"
              title="Event tablosu hazır değil"
              body="Migration uygulanmamış olabilir. Backend governance-status endpoint'ini kontrol edin."
            />
          ) : null}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label={ezaCopy.metrics.events24h} value={data.event_counts.last_24h} />
            <MetricCard label="Olaylar (7g)" value={data.event_counts.last_7d} />
            <MetricCard label="Olaylar (30g)" value={data.event_counts.last_30d} />
            <MetricCard label={ezaCopy.metrics.feedback} value={data.feedback_count} />
            <MetricCard
              label={ezaCopy.metrics.confidence}
              value={data.average_confidence != null ? data.average_confidence.toFixed(1) : '—'}
            />
            <MetricCard
              label={ezaCopy.metrics.reliability}
              value={data.average_reliability != null ? data.average_reliability.toFixed(1) : '—'}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetricCard label="False positive" value={data.false_positive_count} />
            <MetricCard label="False negative" value={data.false_negative_count} />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GovernancePanel title="Kaynak modu dağılımı" noPadding>
              <DistributionBarChart
                data={data.source_mode_distribution}
                emptyTitle="Kaynak modu verisi yok"
                className="border-0 shadow-none"
              />
            </GovernancePanel>
            <GovernancePanel title="Risk etiketi dağılımı" noPadding>
              <DistributionBarChart
                data={data.risk_label_distribution}
                emptyTitle="Risk dağılımı verisi yok"
                className="border-0 shadow-none"
              />
            </GovernancePanel>
          </section>

          <GovernancePanel title="Haftalık kalibrasyon özeti">
            {weekly.error ? <GovernanceErrorState error={weekly.error} /> : null}
            {weekly.isLoading ? (
              <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p>
            ) : null}
            {weekly.data ? (
              <div className="space-y-4">
                {weekly.data.do_not_auto_apply ? (
                  <DoNotAutoApplyBanner disclaimer={weekly.data.disclaimer} />
                ) : null}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                  <div>
                    <span className="text-eza-text-muted text-xs block">Olaylar</span>
                    <span className="font-semibold tabular-nums">{weekly.data.total_events}</span>
                  </div>
                  <div>
                    <span className="text-eza-text-muted text-xs block">Feedback</span>
                    <span className="font-semibold tabular-nums">{weekly.data.total_feedback}</span>
                  </div>
                  <div>
                    <span className="text-eza-text-muted text-xs block">Güven</span>
                    <span className="font-semibold capitalize">{weekly.data.confidence}</span>
                  </div>
                  <div>
                    <span className="text-eza-text-muted text-xs block">FP oranı</span>
                    <span className="font-semibold tabular-nums">
                      {((weekly.data.feedback_quality.false_positive_rate ?? 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                {weekly.data.calibration_suggestions.length > 0 ? (
                  <ul className="space-y-2">
                    {weekly.data.calibration_suggestions.slice(0, 3).map((s, i) => (
                      <li
                        key={`${s.type}-${i}`}
                        className="rounded-lg border border-eza-border bg-eza-surface-muted px-3 py-2 text-sm text-eza-text-secondary"
                      >
                        <span className="font-medium text-eza-text">{s.type}</span>
                        <span className="mx-1.5 text-eza-text-muted">·</span>
                        {s.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-eza-text-muted">Bu dönem için öneri üretilmedi.</p>
                )}
                <Link
                  href="/admin/governance/calibration"
                  className="inline-block text-sm font-medium text-eza-accent hover:text-eza-accent-hover"
                >
                  Kalibrasyon detayı →
                </Link>
              </div>
            ) : null}
          </GovernancePanel>
        </>
      ) : null}
    </div>
  );
}
