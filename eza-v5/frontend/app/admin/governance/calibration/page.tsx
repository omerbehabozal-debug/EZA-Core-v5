'use client';

import useSWR from 'swr';
import { useOrganization } from '@/context/OrganizationContext';
import { getCalibrationSummary } from '@/api/governance';
import { useWeeklyCalibrationReport } from '@/hooks/useWeeklyCalibrationReport';
import { PageHeader, EmptyState, GovernancePanel, InsightCard } from '@/components/eza';
import DistributionBarChart from '@/components/governance/DistributionBarChart';
import DoNotAutoApplyBanner from '@/components/governance/DoNotAutoApplyBanner';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import { ezaCopy } from '@/lib/eza/copy';

export default function GovernanceCalibrationPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  const summary = useSWR(
    orgId ? ['calibration-summary', orgId] : null,
    () => getCalibrationSummary(orgId!, 8)
  );

  const weekly = useWeeklyCalibrationReport(orgId, 1);

  if (!orgId) {
    return (
      <EmptyState
        title="Organizasyon seçin"
        description="Kalibrasyon verileri için organizasyon seçin."
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={ezaCopy.nav.calibration}
        description="İnsan geri bildirimi döngüsü — yalnızca gözlem ve öneri."
      />

      {weekly.data?.do_not_auto_apply !== false ? (
        <DoNotAutoApplyBanner disclaimer={weekly.data?.disclaimer} />
      ) : (
        <DoNotAutoApplyBanner />
      )}

      {summary.error ? <GovernanceErrorState error={summary.error} /> : null}
      {weekly.error ? <GovernanceErrorState error={weekly.error} /> : null}

      {summary.isLoading || weekly.isLoading ? (
        <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p>
      ) : null}

      {summary.data && !summary.error ? (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GovernancePanel title="Feedback tipi dağılımı" noPadding>
            <DistributionBarChart
              data={summary.data.feedback_type_distribution}
              emptyTitle="Feedback verisi yok"
              className="border-0 shadow-none"
            />
          </GovernancePanel>

          <GovernancePanel title="Sertlik oranları">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-eza-text-secondary">Çok sert (strict)</dt>
                <dd className="font-semibold tabular-nums">
                  {summary.data.too_strict_ratio != null
                    ? `${(summary.data.too_strict_ratio * 100).toFixed(1)}%`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-eza-text-secondary">Çok yumuşak (soft)</dt>
                <dd className="font-semibold tabular-nums">
                  {summary.data.too_soft_ratio != null
                    ? `${(summary.data.too_soft_ratio * 100).toFixed(1)}%`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between border-t border-eza-border pt-3">
                <dt className="text-eza-text-secondary">Toplam feedback</dt>
                <dd className="font-semibold tabular-nums">{summary.data.total_feedback}</dd>
              </div>
            </dl>
          </GovernancePanel>
        </section>
      ) : null}

      {summary.data?.most_corrected_risk_labels?.length ? (
        <GovernancePanel title="En çok düzeltilen risk etiketleri">
          <ul className="space-y-2 text-sm">
            {summary.data.most_corrected_risk_labels.map((row) => (
              <li
                key={row.risk_label}
                className="flex justify-between rounded-lg border border-eza-border px-3 py-2"
              >
                <span className="capitalize">{row.risk_label}</span>
                <span className="font-semibold tabular-nums">{row.count}</span>
              </li>
            ))}
          </ul>
        </GovernancePanel>
      ) : null}

      {weekly.data?.top_problem_metrics?.length ? (
        <GovernancePanel title="Sorunlu metrikler (top)">
          <ul className="space-y-2 text-sm">
            {weekly.data.top_problem_metrics.map((m, i) => (
              <li key={`${m.metric_name}-${i}`} className="flex justify-between px-1">
                <span className="font-mono text-eza-text-secondary">{m.metric_name ?? '—'}</span>
                <span className="tabular-nums font-medium">{m.count ?? 0}</span>
              </li>
            ))}
          </ul>
        </GovernancePanel>
      ) : null}

      {weekly.data?.calibration_suggestions?.length ? (
        <GovernancePanel title="Kalibrasyon önerileri">
          <ul className="space-y-3">
            {weekly.data.calibration_suggestions.map((s, i) => (
              <li key={`${s.type}-${i}`}>
                <InsightCard
                  severity={s.severity === 'warning' ? 'caution' : 'notice'}
                  title={s.type}
                  body={s.message}
                  footer={
                    s.status ? (
                      <span className="text-xs text-eza-text-muted">Durum: {s.status}</span>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </GovernancePanel>
      ) : (
        <EmptyState title="Öneri yok" description="Yeterli feedback birikince öneriler görünecek." />
      )}
    </div>
  );
}
