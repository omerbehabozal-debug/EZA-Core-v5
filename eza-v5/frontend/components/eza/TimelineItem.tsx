'use client';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import EventBadge from './EventBadge';
import RiskIndicator from './RiskIndicator';
import ReliabilityPill from './ReliabilityPill';

export interface TimelineItemProps {
  id: string;
  timestamp: string | Date;
  sourceMode?: string;
  eventType?: string;
  entityType?: string;
  riskLabel?: string;
  riskScore?: number | null;
  confidenceScore?: number | null;
  reliabilityScore?: number | null;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function TimelineItem({
  id,
  timestamp,
  sourceMode,
  eventType,
  entityType,
  riskLabel,
  riskScore,
  confidenceScore,
  reliabilityScore,
  selected,
  onClick,
  className,
}: TimelineItemProps) {
  const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'group w-full text-left rounded-xl border p-3 sm:p-4 transition-colors',
        selected
          ? 'border-eza-accent bg-eza-accent-muted shadow-eza-sm'
          : 'border-eza-border bg-eza-surface hover:border-eza-border-strong hover:bg-eza-surface-muted',
        !interactive && 'cursor-default',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <time className="text-[10px] sm:text-xs text-eza-text-muted tabular-nums">
          {formatDate(timestamp)}
        </time>
        <span className="font-mono text-[10px] text-eza-text-muted">{shortId}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {sourceMode ? <EventBadge variant="mode">{sourceMode}</EventBadge> : null}
        {entityType ? <EventBadge variant="entity">{entityType}</EventBadge> : null}
        {eventType ? <EventBadge variant="type">{eventType}</EventBadge> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {riskLabel ? <RiskIndicator level={riskLabel} /> : null}
        {confidenceScore != null ? (
          <span className="text-[10px] sm:text-xs text-eza-text-secondary tabular-nums">
            Güven {Math.round(confidenceScore)}
          </span>
        ) : null}
        <ReliabilityPill score={reliabilityScore ?? undefined} />
        {riskScore != null ? (
          <span className="text-[10px] sm:text-xs text-eza-text-muted tabular-nums ml-auto">
            Risk {Math.round(riskScore)}
          </span>
        ) : null}
      </div>
    </button>
  );
}
