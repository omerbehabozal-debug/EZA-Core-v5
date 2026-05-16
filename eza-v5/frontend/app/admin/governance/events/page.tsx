'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/context/OrganizationContext';
import { useAdminEvents } from '@/hooks/useAdminEvents';
import { PageHeader, EmptyState, TimelineItem } from '@/components/eza';
import GovernancePanel from '@/components/eza/GovernancePanel';
import GovernanceErrorState from '@/components/governance/GovernanceErrorState';
import { ezaCopy } from '@/lib/eza/copy';

export default function GovernanceEventsPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id ?? null;

  const [days, setDays] = useState(30);
  const [sourceMode, setSourceMode] = useState('');
  const [eventType, setEventType] = useState('');
  const [userId, setUserId] = useState('');

  const { data, error, isLoading } = useAdminEvents(orgId, {
    days,
    limit: 100,
    source_mode: sourceMode || undefined,
    event_type: eventType || undefined,
    user_id: userId || undefined,
  });

  if (!orgId) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title={ezaCopy.nav.events} />
        <EmptyState
          className="mt-6"
          title="Organizasyon seçin"
          description="Olay listesi için üst çubuktan organizasyon seçin."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={ezaCopy.nav.events}
        description="Organizasyon kapsamındaki universal event kayıtları (ham mesaj içermez)."
      />

      <GovernancePanel title="Filtreler">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-eza-text-muted">
            Gün
            <select
              className="mt-1 w-full rounded-lg border border-eza-border px-2 py-1.5 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7</option>
              <option value={30}>30</option>
              <option value={90}>90</option>
            </select>
          </label>
          <label className="block text-xs text-eza-text-muted">
            Kaynak modu
            <input
              className="mt-1 w-full rounded-lg border border-eza-border px-2 py-1.5 text-sm"
              placeholder="standalone"
              value={sourceMode}
              onChange={(e) => setSourceMode(e.target.value)}
            />
          </label>
          <label className="block text-xs text-eza-text-muted">
            Event tipi
            <input
              className="mt-1 w-full rounded-lg border border-eza-border px-2 py-1.5 text-sm"
              placeholder="message"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
            />
          </label>
          <label className="block text-xs text-eza-text-muted">
            Kullanıcı ID
            <input
              className="mt-1 w-full rounded-lg border border-eza-border px-2 py-1.5 text-sm font-mono"
              placeholder="UUID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </label>
        </div>
      </GovernancePanel>

      {error ? <GovernanceErrorState error={error} /> : null}

      {isLoading ? <p className="text-sm text-eza-text-muted">{ezaCopy.empty.loading}</p> : null}

      {data && !error ? (
        <GovernancePanel
          title={`${data.count} olay`}
          description={`Org: ${data.org_id.slice(0, 8)}…`}
        >
          {data.events.length === 0 ? (
            <EmptyState title={ezaCopy.empty.noEvents} />
          ) : (
            <ul className="space-y-2">
              {data.events.map((ev) => (
                <li key={ev.id}>
                  <TimelineItem
                    id={ev.id}
                    timestamp={ev.timestamp ?? new Date().toISOString()}
                    sourceMode={ev.source_mode}
                    entityType={ev.entity_type}
                    eventType={ev.event_type}
                    riskLabel={ev.risk_label ?? undefined}
                    riskScore={ev.risk_score}
                    confidenceScore={ev.confidence_score}
                    reliabilityScore={ev.reliability_score}
                    onClick={() => router.push(`/admin/governance/events/${ev.id}`)}
                  />
                </li>
              ))}
            </ul>
          )}
        </GovernancePanel>
      ) : null}
    </div>
  );
}
