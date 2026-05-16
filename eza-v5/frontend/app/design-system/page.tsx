'use client';

/**
 * EZA Design System — component gallery (Stage 1).
 * Review at /design-system — no backend calls.
 */

import GovernanceShell from '@/components/Layout/GovernanceShell';
import {
  PageHeader,
  MetricCard,
  InsightCard,
  TrendChart,
  EventBadge,
  ReliabilityPill,
  RiskIndicator,
  GovernancePanel,
  TimelineItem,
  EmptyState,
} from '@/components/eza';
import { ezaCopy } from '@/lib/eza/copy';

const sampleTrend = [
  { label: 'Pzt', value: 42 },
  { label: 'Sal', value: 48 },
  { label: 'Çar', value: 45 },
  { label: 'Per', value: 52 },
  { label: 'Cum', value: 58 },
  { label: 'Cmt', value: 55 },
  { label: 'Paz', value: 61 },
];

export default function DesignSystemPage() {
  return (
    <GovernanceShell orgLabel="Demo Organization">
      <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
        <PageHeader
          title="EZA Design System"
          description="Governance UI bileşenleri — Aşama 1. Premium, sade, kurumsal gözlem dili."
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label={ezaCopy.metrics.events24h} value={128} trend="up" trendLabel="+12%" />
          <MetricCard label={ezaCopy.metrics.feedback} value={34} hint="Son 30 gün" />
          <MetricCard
            label={ezaCopy.metrics.confidence}
            value="72"
            trend="neutral"
            trendLabel="Stabil"
          />
          <MetricCard label={ezaCopy.metrics.reliability} value="—" hint="Veri bekleniyor" />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GovernancePanel title="AI interaction trend" description="Sayısal gözlem — ham mesaj yok">
            <TrendChart data={sampleTrend} valueLabel="Gözlem skoru" />
          </GovernancePanel>

          <GovernancePanel title="Insight" description="Güvenli dil örneği">
            <InsightCard
              severity="notice"
              title="AI reliance observation"
              body="Son hafta etkileşim dengesi hafif asimetrik. Bu bir güvenlik kararı değil; kalibrasyon gözlemidir."
              footer={
                <p className="text-xs text-eza-text-muted">{ezaCopy.disclaimer.advisory}</p>
              }
            />
          </GovernancePanel>
        </div>

        <GovernancePanel title="Badges & indicators">
          <div className="flex flex-wrap items-center gap-3">
            <EventBadge variant="mode">standalone</EventBadge>
            <EventBadge variant="entity">user</EventBadge>
            <EventBadge variant="type">message</EventBadge>
            <RiskIndicator level="low" />
            <RiskIndicator level="medium" />
            <RiskIndicator level="high" />
            <ReliabilityPill score={82} />
            <ReliabilityPill score={48} />
            <ReliabilityPill band="unknown" />
          </div>
        </GovernancePanel>

        <GovernancePanel title="Event timeline item" description="Aşama 4’te liste olarak kullanılacak">
          <div className="max-w-md space-y-2">
            <TimelineItem
              id="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
              timestamp={new Date().toISOString()}
              sourceMode="standalone"
              entityType="user"
              eventType="message"
              riskLabel="low"
              riskScore={22}
              confidenceScore={78}
              reliabilityScore={85}
              selected
            />
            <TimelineItem
              id="b2c3d4e5-f6a7-8901-bcde-f12345678901"
              timestamp={new Date(Date.now() - 3600000).toISOString()}
              sourceMode="proxy"
              entityType="user"
              eventType="message"
              riskLabel="medium"
              riskScore={55}
              confidenceScore={62}
            />
          </div>
        </GovernancePanel>

        <GovernancePanel title="Empty state">
          <EmptyState
            title={ezaCopy.empty.noEvents}
            description="Backend bağlandığında bu alan dolacak (Aşama 2)."
          />
        </GovernancePanel>
      </div>
    </GovernanceShell>
  );
}
