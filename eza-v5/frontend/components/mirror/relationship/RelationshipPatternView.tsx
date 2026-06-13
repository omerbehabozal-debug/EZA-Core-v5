'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { standaloneSkin } from '@/lib/eza/standaloneSkin';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { MirrorStateMeta } from '@/lib/eza/mirror/types';
import {
  buildRelationshipDashboardMetrics,
  RELATIONSHIP_PERIOD_OPTIONS,
  type RelationshipPeriodFilter,
} from '@/lib/eza/mirror/relationshipPatternMetrics';
import BehaviorIslandsMap from '@/components/mirror/relationship/BehaviorIslandsMap';
import IslandDetailPanel from '@/components/mirror/relationship/IslandDetailPanel';
import RelationshipSummaryCard from '@/components/mirror/relationship/RelationshipSummaryCard';
import BehaviorToneBars from '@/components/mirror/relationship/BehaviorToneBars';
import RelationshipBalanceBars from '@/components/mirror/relationship/RelationshipBalanceBars';
import RelationshipTimelineChart from '@/components/mirror/relationship/RelationshipTimelineChart';
import RelationshipInsightNote from '@/components/mirror/relationship/RelationshipInsightNote';
import ActiveTimeCard from '@/components/mirror/relationship/ActiveTimeCard';
import InteractionDepthCard from '@/components/mirror/relationship/InteractionDepthCard';
import PatternPreviewSectionNote from '@/components/mirror/relationship/PatternPreviewSectionNote';
import {
  PATTERN_PREVIEW_AI_BARS,
  PATTERN_PREVIEW_BALANCE_BARS,
  PATTERN_PREVIEW_BALANCE_HINT,
  PATTERN_PREVIEW_BALANCE_LABEL,
  PATTERN_PREVIEW_DEPTH,
  PATTERN_PREVIEW_INSIGHT,
  PATTERN_PREVIEW_TIME_BUCKETS,
  PATTERN_PREVIEW_TIMELINE,
} from '@/components/mirror/relationship/patternPreviewContent';

export type RelationshipPatternViewProps = {
  entries: SavedBehavioralEntry[];
  meta?: MirrorStateMeta;
  className?: string;
  /** Free plan — trend/içgörü alanları silik sabit placeholder. */
  previewMode?: boolean;
};

type PatternLevel = 'map' | 'trends' | 'insights';

const LEVELS: { id: PatternLevel; label: string }[] = [
  { id: 'map', label: 'Harita' },
  { id: 'trends', label: 'Trendler' },
  { id: 'insights', label: 'İçgörüler' },
];

const sp = standaloneSkin.sainaPatternPolish;

export default function RelationshipPatternView({
  entries,
  className,
  previewMode = false,
}: RelationshipPatternViewProps) {
  const [period, setPeriod] = useState<RelationshipPeriodFilter>(30);
  const [level, setLevel] = useState<PatternLevel>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fadeKey, setFadeKey] = useState(0);
  const reducedMotion = useReducedMotion();

  const metrics = useMemo(
    () => buildRelationshipDashboardMetrics(entries, period),
    [entries, period]
  );

  const handlePeriod = (value: RelationshipPeriodFilter) => {
    if (value === period) return;
    setPeriod(value);
    setSelectedId(null);
    setFadeKey((k) => k + 1);
  };

  const handleLevel = (next: PatternLevel) => {
    if (next === level) return;
    setLevel(next);
    if (next !== 'map') setSelectedId(null);
    setFadeKey((k) => k + 1);
  };

  const animated = !reducedMotion;
  const balanceScore =
    metrics.interactionDepth.score != null
      ? Math.round((metrics.interactionDepth.score / 10) * 100)
      : 68;

  const selectedIsland = useMemo(
    () => metrics.displayIslands.find((i) => i.id === selectedId) ?? null,
    [metrics.displayIslands, selectedId]
  );

  const growingIslands = metrics.islands.filter((i) => i.trend === 'growing');
  const fadingIslands = metrics.islands.filter((i) => i.trend === 'fading');
  const risingLabel = metrics.pattern.risingPattern?.label ?? null;
  const dominantLabel =
    metrics.pattern.dominantIsland?.label ?? metrics.islands[0]?.label ?? null;
  const peakActive = [...metrics.activeTimeBuckets].sort((a, b) => b.percent - a.percent)[0] ?? null;

  return (
    <section
      className={cn('relative z-[1] mx-auto flex w-full max-w-[1120px] flex-col', className)}
      aria-label="AI İlişki Deseni"
    >
      <header className="saina-pattern-header shrink-0">
        <span className="saina-pattern-eyebrow">AKTİF GÖRÜNÜM</span>
        <h1 className="saina-pattern-title">İlişki Deseni</h1>
        <p className="saina-pattern-subtitle">
          Son 30 günde sohbetlerin arasında oluşan düşünce ağı.
        </p>
      </header>

      <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <nav
          className={sp.levelNav}
          role="tablist"
          aria-label="İlişki haritası seviyeleri"
        >
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={level === l.id}
              onClick={() => handleLevel(l.id)}
              className={level === l.id ? sp.levelTabActive : sp.levelTabIdle}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className={sp.periodNav} role="tablist" aria-label="Dönem filtresi">
          {RELATIONSHIP_PERIOD_OPTIONS.map((p) => (
            <button
              key={String(p.value)}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              onClick={() => handlePeriod(p.value)}
              className={period === p.value ? sp.periodTabActive : sp.periodTabIdle}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div
        key={fadeKey}
        className={cn('relative mt-3 flex min-h-0 flex-1 flex-col', animated && 'animate-fade-in')}
      >
        {level === 'map' ? (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_minmax(260px,300px)] lg:items-stretch">
            <section
              className={sp.mapCard}
              aria-labelledby="behavior-islands-title"
            >
              <div className="flex shrink-0 items-baseline justify-between gap-2">
                <p
                  id="behavior-islands-title"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0F3D32]/65"
                >
                  Davranış Adaların
                </p>
                {metrics.isEmpty ? (
                  <p className="text-[11px] text-[#6B6B62]">
                    Desen henüz oluşmadı — gözlenen alanlar aşağıda.
                  </p>
                ) : null}
              </div>

              <BehaviorIslandsMap
                islands={metrics.displayIslands}
                interactive
                selectedId={selectedId}
                onSelectIsland={(island) =>
                  setSelectedId((prev) => (prev === island.id ? null : island.id))
                }
                centerLabel="SEN"
                animated={animated}
                className="mt-1 min-h-0 flex-1"
              />
            </section>

            <aside className="min-h-0">
              {selectedIsland ? (
                <IslandDetailPanel
                  island={selectedIsland}
                  active={selectedIsland.active}
                  onClose={() => setSelectedId(null)}
                />
              ) : (
                <RelationshipSummaryCard
                  label={
                    previewMode ? PATTERN_PREVIEW_BALANCE_LABEL : metrics.generalBalanceLabel
                  }
                  hint={
                    previewMode
                      ? PATTERN_PREVIEW_BALANCE_HINT
                      : metrics.generalBalanceHint ||
                        'Etkileşimlerin sağlıklı bir ritimde ilerliyor.'
                  }
                  scorePercent={balanceScore}
                  preview={previewMode}
                />
              )}
            </aside>
          </div>
        ) : null}

        {level === 'trends' ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
            {previewMode ? (
              <section className="pointer-events-none grid select-none gap-4 opacity-45 saturate-[0.55] md:grid-cols-2">
                <div className={sp.trendCard}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#6B6B62]">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Büyüyen alanlar
                  </h3>
                  <p className="mt-3 text-sm text-[#6B6B62]">—</p>
                </div>
                <div className={sp.trendCard}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#6B6B62]">
                    <ArrowDownRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Azalan alanlar
                  </h3>
                  <p className="mt-3 text-sm text-[#6B6B62]">—</p>
                </div>
              </section>
            ) : metrics.isEmpty ? (
              <p className={sp.emptyState}>Trendler için henüz yeterli etkileşim yok.</p>
            ) : (
              <section className="grid gap-4 md:grid-cols-2">
                <div className={sp.trendCard}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0F3D32]">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Büyüyen alanlar
                  </h3>
                  {growingIslands.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {growingIslands.map((i) => (
                        <li
                          key={i.id}
                          className="rounded-full px-3 py-1 text-xs font-medium text-[#18332D]"
                          style={{ background: `${i.color}66` }}
                        >
                          {i.label} · %{i.percent}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[#6B6B62]">Belirgin bir yükseliş yok.</p>
                  )}
                </div>

                <div className={sp.trendCard}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[#8B6914]">
                    <ArrowDownRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Azalan alanlar
                  </h3>
                  {fadingIslands.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {fadingIslands.map((i) => (
                        <li
                          key={i.id}
                          className="rounded-full px-3 py-1 text-xs font-medium text-[#18332D]"
                          style={{ background: `${i.color}66` }}
                        >
                          {i.label} · %{i.percent}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[#6B6B62]">Eğilimlerin dengede.</p>
                  )}
                </div>
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <RelationshipTimelineChart
                points={previewMode ? PATTERN_PREVIEW_TIMELINE : metrics.timelinePoints}
                preview={previewMode}
              />
              <RelationshipBalanceBars
                bars={previewMode ? PATTERN_PREVIEW_BALANCE_BARS : metrics.balanceBars}
                preview={previewMode}
              />
            </div>
            {previewMode ? <PatternPreviewSectionNote /> : null}
          </div>
        ) : null}

        {level === 'insights' ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
            {previewMode ? (
              <section className="pointer-events-none select-none rounded-[2rem] border border-[#D8B16A]/20 bg-[#FFFCF5]/85 p-5 opacity-45 saturate-[0.55]">
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    'En çok gelişen alan',
                    'En aktif dönem',
                    'Baskın biçim',
                    'En dikkat çekici değişim',
                  ].map((label) => (
                    <div key={label} className={sp.insightTile}>
                      <dt className="text-xs font-medium text-[#6B6B62]">{label}</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-[#6B6B62]/50">—</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : metrics.isEmpty ? (
              <p className={sp.emptyState}>İçgörüler için henüz yeterli etkileşim yok.</p>
            ) : (
              <section className={sp.insightCard}>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className={sp.insightTile}>
                    <dt className="text-xs font-medium text-[#6B6B62]">En çok gelişen alan</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#18332D]">
                      {risingLabel ?? 'Belirgin yükseliş yok'}
                    </dd>
                  </div>
                  <div className={sp.insightTile}>
                    <dt className="text-xs font-medium text-[#6B6B62]">En aktif dönem</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#18332D]">
                      {peakActive ? `${peakActive.label} · %${peakActive.percent}` : '—'}
                    </dd>
                  </div>
                  <div className={sp.insightTile}>
                    <dt className="text-xs font-medium text-[#6B6B62]">Baskın biçim</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#18332D]">
                      {dominantLabel ?? '—'}
                    </dd>
                  </div>
                  <div className={sp.insightTile}>
                    <dt className="text-xs font-medium text-[#6B6B62]">En dikkat çekici değişim</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#18332D]">
                      {growingIslands[0]
                        ? `${growingIslands[0].label} yükselişte`
                        : fadingIslands[0]
                          ? `${fadingIslands[0].label} soluyor`
                          : 'Desen dengede'}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            <RelationshipInsightNote
              body={previewMode ? PATTERN_PREVIEW_INSIGHT : metrics.insightNote}
              preview={previewMode}
            />
            <div className="grid gap-4 md:grid-cols-3">
              <BehaviorToneBars
                title="AI Davranış Haritası"
                subtitle="AI sana en çok şu tonlarda yanıt verdi."
                bars={previewMode ? PATTERN_PREVIEW_AI_BARS : metrics.aiBehaviorBars}
                preview={previewMode}
              />
              <ActiveTimeCard
                buckets={previewMode ? PATTERN_PREVIEW_TIME_BUCKETS : metrics.activeTimeBuckets}
                preview={previewMode}
              />
              <InteractionDepthCard
                metric={previewMode ? PATTERN_PREVIEW_DEPTH : metrics.interactionDepth}
                preview={previewMode}
              />
            </div>
            {previewMode ? <PatternPreviewSectionNote /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
