'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import type {
  MirrorBehaviorIsland,
  MirrorRisingPattern,
  MirrorStateMeta,
} from '@/lib/eza/mirror/types';
import type { BehaviorIsland, RelationshipPeriodDays } from '@/lib/eza/relationshipMapModel';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import BehaviorIslandsCluster from '@/components/standalone/BehaviorIslandsCluster';
import {
  MIRROR_PATTERN_BALANCE_LABEL,
  MIRROR_PATTERN_BODY,
  MIRROR_PATTERN_EMPTY_BODY,
  MIRROR_PATTERN_EMPTY_TITLE,
  MIRROR_PATTERN_INSUFFICIENT,
  MIRROR_PATTERN_INTRO,
  MIRROR_PATTERN_ISLANDS_HEADING,
  MIRROR_PATTERN_ISLANDS_SUB,
  MIRROR_PATTERN_TITLE,
  MIRROR_PRIVACY_SHORT,
} from '@/lib/eza/mirror/copy';

const ISLAND_COLORS: Record<string, string> = {
  exploration: '#a78bfa',
  decision_support: '#60a5fa',
  clarity_seek: '#34d399',
  creative_ideas: '#fbbf24',
  intellectual_depth: '#818cf8',
  explanation_seek: '#fb923c',
  sensitive_signals: '#f97316',
  safe_balance: '#2dd4bf',
  flow_harmony: '#4ade80',
  balanced: '#94a3b8',
  quiet: '#cbd5e1',
  question_clarity: '#38bdf8',
};

const PERIODS: { days: RelationshipPeriodDays; label: string }[] = [
  { days: 7, label: '7 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
];

function toBehaviorIslands(islands: MirrorBehaviorIsland[]): BehaviorIsland[] {
  return islands.map((island) => ({
    ...island,
    color: ISLAND_COLORS[island.id] ?? '#94a3b8',
  }));
}

function dominantObservationLine(island: MirrorBehaviorIsland | null): string | null {
  if (!island) return null;
  return `Son dönemde “${island.label}” teması ilişki deseninde daha görünür hale geldi.`;
}

function risingObservationLine(rising: MirrorRisingPattern | null): string | null {
  if (!rising) return null;
  return `AI ile kurduğun bağda “${rising.label}” eğilimi daha belirginleşiyor.`;
}

function SummaryBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="space-y-1.5 rounded-2xl border border-stone-100/90 bg-white/55 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        {title}
      </p>
      <p className="text-sm leading-relaxed text-stone-700">{body}</p>
    </div>
  );
}

export type RelationshipPatternViewProps = {
  entries: SavedBehavioralEntry[];
  meta?: MirrorStateMeta;
  className?: string;
};

export default function RelationshipPatternView({
  entries,
  meta: metaProp,
  className,
}: RelationshipPatternViewProps) {
  const [period, setPeriod] = useState<RelationshipPeriodDays>(30);
  const [fadeKey, setFadeKey] = useState(0);
  const reducedMotion = useReducedMotion();
  const islandSkin = standaloneSkin.relationshipMapPolish;
  const mot = standaloneSkin.motion;

  const { relationshipPattern: pattern, meta: metaFromEngine } = useMemo(
    () => buildMirrorState(entries, { periodDays: period }),
    [entries, period]
  );

  const meta = metaProp ?? metaFromEngine;
  const islands = useMemo(
    () => toBehaviorIslands(pattern.behaviorIslands),
    [pattern.behaviorIslands]
  );
  const isEmpty = islands.length === 0;
  const isSparse = !meta.hasEnoughData;
  const anim = (cls: string) => (!reducedMotion ? cls : '');

  const handlePeriod = (days: RelationshipPeriodDays) => {
    if (days === period) return;
    setPeriod(days);
    setFadeKey((k) => k + 1);
  };

  const dominantLine = dominantObservationLine(pattern.dominantIsland);
  const risingLine = risingObservationLine(pattern.risingPattern);

  return (
    <section
      className={cn(
        'relative space-y-8 overflow-hidden rounded-[1.75rem]',
        className
      )}
      aria-label="AI İlişki Deseni"
    >
      <div
        className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-violet-100/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-32 h-48 w-48 rounded-full bg-sky-100/40 blur-3xl"
        aria-hidden
      />

      <header className="relative space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          {MIRROR_PATTERN_TITLE}
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-stone-600 sm:text-[15px]">
          {MIRROR_PATTERN_INTRO}
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-stone-500">
          {MIRROR_PATTERN_BODY}
        </p>
      </header>

      <div className="relative flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-full border border-violet-100/80 bg-white/70 p-1 shadow-sm"
          role="tablist"
          aria-label="Zaman filtresi"
        >
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="tab"
              aria-selected={period === p.days}
              onClick={() => handlePeriod(p.days)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                period === p.days
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-stone-600 hover:bg-violet-50/80 hover:text-stone-900'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <article className="relative rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-violet-50/40 px-5 py-4 shadow-[0_8px_32px_-16px_rgba(99,102,241,0.18)] sm:px-6 sm:py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          {MIRROR_PATTERN_BALANCE_LABEL}
        </p>
        <p className="mt-2 text-lg font-medium text-stone-900">
          {pattern.generalBalanceLabel}
        </p>
        {isSparse ? (
          <p className="mt-2 text-sm text-stone-500">{MIRROR_PATTERN_INSUFFICIENT}</p>
        ) : null}
      </article>

      <section
        className="relative space-y-4"
        aria-labelledby="mirror-behavior-islands-heading"
      >
        <div className="space-y-1">
          <h3
            id="mirror-behavior-islands-heading"
            className="text-base font-semibold text-stone-800"
          >
            {MIRROR_PATTERN_ISLANDS_HEADING}
          </h3>
          <p className="text-sm text-stone-500">{MIRROR_PATTERN_ISLANDS_SUB}</p>
        </div>

        <div
          key={fadeKey}
          className={cn(
            islandSkin.islandsCanvas,
            'min-h-[22rem] rounded-[1.5rem] border border-violet-100/50 bg-gradient-to-b from-violet-50/25 via-white/80 to-sky-50/30 sm:min-h-[26rem] lg:min-h-[28rem]',
            anim(mot.fadeIn2)
          )}
        >
          {isEmpty ? (
            <div className={islandSkin.emptyIslands}>
              <p className={islandSkin.emptyTitle}>{MIRROR_PATTERN_EMPTY_TITLE}</p>
              <p className={islandSkin.emptyBody}>{MIRROR_PATTERN_EMPTY_BODY}</p>
            </div>
          ) : (
            <BehaviorIslandsCluster
              islands={islands}
              fadeKey={fadeKey}
              reducedMotion={reducedMotion}
            />
          )}
        </div>
      </section>

      <footer className="relative space-y-4 border-t border-stone-100/90 pt-6">
        <p className="text-xs leading-relaxed text-stone-500">{MIRROR_PRIVACY_SHORT}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {dominantLine ? (
            <SummaryBlock title="Belirgin tema" body={dominantLine} />
          ) : null}
          {risingLine ? <SummaryBlock title="Yükselen eğilim" body={risingLine} /> : null}
          <SummaryBlock title="Ritim" body={pattern.rhythmSummary} />
          <SummaryBlock title="Kısa iz notu" body={pattern.editorialNote} />
        </div>

        {pattern.confidence && !isSparse ? (
          <p className="text-center text-xs text-stone-400">{pattern.confidence}</p>
        ) : null}
      </footer>
    </section>
  );
}
