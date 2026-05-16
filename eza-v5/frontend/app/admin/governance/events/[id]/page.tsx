'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrganization } from '@/context/OrganizationContext';
import { useAdminEventDetail } from '@/hooks/useAdminEvents';
import {
  PageHeader,
  EmptyState,
  GovernancePanel,
  ReliabilityPill,
  RiskIndicator,
  EventBadge,
} from '@/components/eza';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import SafeJsonBlock, { sanitizeEngineVotes } from '@/components/governance/SafeJsonBlock';
import { sanitizeRecord } from '@/lib/governance/display';
import { formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { ezaCopy } from '@/lib/eza/copy';

export default function GovernanceEventDetailPage() {
  const params = useParams();
  const eventId =
    params && typeof params.id === 'string' ? params.id : '';
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  const { data, error, isLoading } = useAdminEventDetail(orgId, eventId);

  if (!orgId) {
    return (
      <EmptyState
        title="Organizasyon seçin"
        description="Event detayı için organizasyon seçin."
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/governance/events"
        className="inline-flex items-center gap-1 text-sm font-medium text-eza-accent hover:text-eza-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" />
        Olaylara dön
      </Link>

      {error ? <GovernanceErrorState error={error} /> : null}
      {isLoading ? <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p> : null}

      {data && !error ? (
        <>
          <PageHeader
            title="Olay detayı"
            description={data.timestamp ? formatDate(data.timestamp) : '—'}
          />

          <div className="flex flex-wrap gap-2">
            {data.source_mode ? <EventBadge variant="mode">{data.source_mode}</EventBadge> : null}
            {data.entity_type ? <EventBadge variant="entity">{data.entity_type}</EventBadge> : null}
            {data.event_type ? <EventBadge variant="type">{data.event_type}</EventBadge> : null}
            {data.risk_label ? <RiskIndicator level={data.risk_label} /> : null}
            <ReliabilityPill score={data.reliability_score} />
          </div>

          <GovernancePanel title="Skorlar">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-eza-text-muted">Risk skoru</dt>
                <dd className="font-semibold tabular-nums">{data.risk_score ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-eza-text-muted">Güven</dt>
                <dd className="font-semibold tabular-nums">{data.confidence_score ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-eza-text-muted">Güvenilirlik</dt>
                <dd className="font-semibold tabular-nums">{data.reliability_score ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-eza-text-muted">Yorumlanabilir</dt>
                <dd className="font-semibold">{data.can_interpret ? 'Evet' : 'Hayır'}</dd>
              </div>
            </dl>
          </GovernancePanel>

          <GovernancePanel title="Skor vektörü">
            <SafeJsonBlock
              title="score_vector"
              data={sanitizeRecord((data.score_vector as Record<string, unknown>) ?? {})}
            />
          </GovernancePanel>

          <GovernancePanel title="Motor oyları">
            <SafeJsonBlock title="engine_votes" data={sanitizeEngineVotes(data.engine_votes as Record<string, unknown>)} />
          </GovernancePanel>

          <GovernancePanel title="Karar izi">
            <SafeJsonBlock
              title="decision_trace"
              data={
                Array.isArray(data.decision_trace)
                  ? data.decision_trace
                  : sanitizeRecord(
                      (data.decision_trace as Record<string, unknown>) ?? {}
                    )
              }
            />
          </GovernancePanel>

          <GovernancePanel
            title="Geri bildirim geçmişi"
            description={`${data.feedback_history?.length ?? 0} kayıt`}
          >
            {!data.feedback_history?.length ? (
              <EmptyState title="Henüz geri bildirim yok" className="py-6" />
            ) : (
              <ul className="space-y-2">
                {data.feedback_history.map((fb) => (
                  <li
                    key={fb.id}
                    className="rounded-lg border border-eza-border bg-eza-surface-muted px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium text-eza-text">{fb.feedback_type}</span>
                      <time className="text-xs text-eza-text-muted">
                        {fb.timestamp ? formatDate(fb.timestamp) : '—'}
                      </time>
                    </div>
                    {fb.metric_name ? (
                      <p className="mt-1 text-xs text-eza-text-secondary">
                        Metrik: {fb.metric_name}
                      </p>
                    ) : null}
                    {fb.notes ? (
                      <p className="mt-1 text-xs text-eza-text-muted line-clamp-2">{fb.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </GovernancePanel>

          <p className="font-mono text-[10px] text-eza-text-muted break-all">ID: {data.id}</p>
        </>
      ) : null}
    </div>
  );
}
