'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export type RelationshipPatternViewProps = {
  entries: SavedBehavioralEntry[];
  meta?: MirrorStateMeta;
  className?: string;
};

type PatternLevel = 'map' | 'trends' | 'insights';

const LEVELS: { id: PatternLevel; label: string }[] = [
  { id: 'map', label: 'Harita' },
  { id: 'trends', label: 'Trendler' },
  { id: 'insights', label: 'İçgörüler' },
];

export default function RelationshipPatternView({
  entries,
  className,
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

  // Sunum amaçlı türevler — yalnızca mevcut metrics alanları okunur (mantık değişmez).
  const growingIslands = metrics.islands.filter((i) => i.trend === 'growing');
  const fadingIslands = metrics.islands.filter((i) => i.trend === 'fading');
  const risingLabel = metrics.pattern.risingPattern?.label ?? null;
  const dominantLabel =
    metrics.pattern.dominantIsland?.label ?? metrics.islands[0]?.label ?? null;
  const peakActive = [...metrics.activeTimeBuckets].sort((a, b) => b.percent - a.percent)[0] ?? null;

  return (
    <section
      className={cn('relative mx-auto flex w-full max-w-[1120px] flex-col', className)}
      aria-label="AI İlişki Deseni"
    >
      {/* Kompakt kontrol çubuğu: seviye + dönem */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <nav
          className="inline-flex rounded-full border border-stone-200/80 bg-white/70 p-1 shadow-sm backdrop-blur-sm"
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
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all',
                level === l.id
                  ? 'bg-[#172033] text-white shadow-sm'
                  : 'text-[#667085] hover:text-[#172033]'
              )}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div
          className="inline-flex rounded-full border border-violet-100/90 bg-white/75 p-0.5 shadow-sm backdrop-blur-sm"
          role="tablist"
          aria-label="Dönem filtresi"
        >
          {RELATIONSHIP_PERIOD_OPTIONS.map((p) => (
            <button
              key={String(p.value)}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              onClick={() => handlePeriod(p.value)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                period === p.value
                  ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B84FF] text-white shadow'
                  : 'text-[#667085] hover:text-[#172033]'
              )}
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
        {/* ---- SEVİYE 1 — HARİTA ---- */}
        {level === 'map' ? (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_minmax(260px,300px)] lg:items-stretch">
            <section
              className="relative flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/90 bg-gradient-to-b from-white/95 via-[#F8F6F1]/55 to-violet-50/30 p-3 shadow-[0_20px_60px_-24px_rgba(123,97,255,0.22)] sm:p-5"
              aria-labelledby="behavior-islands-title"
            >
              <div className="flex shrink-0 items-baseline justify-between gap-2">
                <p
                  id="behavior-islands-title"
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7B61FF]/70"
                >
                  Davranış Adaların
                </p>
                {metrics.isEmpty ? (
                  <p className="text-[11px] text-[#667085]">
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
                  label={metrics.generalBalanceLabel}
                  hint={
                    metrics.generalBalanceHint || 'Etkileşimlerin sağlıklı bir ritimde ilerliyor.'
                  }
                  scorePercent={balanceScore}
                />
              )}
            </aside>
          </div>
        ) : null}

        {/* ---- SEVİYE 2 — TRENDLER ---- */}
        {level === 'trends' ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
            {metrics.isEmpty ? (
              <p className="rounded-2xl border border-dashed border-violet-200/70 bg-white/50 px-4 py-6 text-center text-sm text-[#667085]">
                Trendler için henüz yeterli etkileşim yok.
              </p>
            ) : (
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.75rem] border border-white/90 bg-white/85 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Büyüyen alanlar
                  </h3>
                  {growingIslands.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {growingIslands.map((i) => (
                        <li
                          key={i.id}
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{ background: `${i.color}1f`, color: '#172033' }}
                        >
                          {i.label} · %{i.percent}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[#667085]">Belirgin bir yükseliş yok.</p>
                  )}
                </div>

                <div className="rounded-[1.75rem] border border-white/90 bg-white/85 p-5 shadow-[0_10px_36px_-16px_rgba(23,32,51,0.12)]">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                    <ArrowDownRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Azalan alanlar
                  </h3>
                  {fadingIslands.length ? (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {fadingIslands.map((i) => (
                        <li
                          key={i.id}
                          className="rounded-full px-3 py-1 text-xs font-medium"
                          style={{ background: `${i.color}1f`, color: '#172033' }}
                        >
                          {i.label} · %{i.percent}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-[#667085]">Eğilimlerin dengede.</p>
                  )}
                </div>
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <RelationshipTimelineChart points={metrics.timelinePoints} />
              <RelationshipBalanceBars bars={metrics.balanceBars} />
            </div>
          </div>
        ) : null}

        {/* ---- SEVİYE 3 — İÇGÖRÜLER ---- */}
        {level === 'insights' ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
            {metrics.isEmpty ? (
              <p className="rounded-2xl border border-dashed border-violet-200/70 bg-white/50 px-4 py-6 text-center text-sm text-[#667085]">
                İçgörüler için henüz yeterli etkileşim yok.
              </p>
            ) : (
              <section className="rounded-[2rem] border border-white/90 bg-gradient-to-b from-white/95 to-violet-50/30 p-5 shadow-[0_16px_48px_-22px_rgba(123,97,255,0.2)]">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#EDE8F8] bg-white/70 px-4 py-3">
                    <dt className="text-xs font-medium text-[#667085]">En çok gelişen alan</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#172033]">
                      {risingLabel ?? 'Belirgin yükseliş yok'}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-[#EDE8F8] bg-white/70 px-4 py-3">
                    <dt className="text-xs font-medium text-[#667085]">En aktif dönem</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#172033]">
                      {peakActive ? `${peakActive.label} · %${peakActive.percent}` : '—'}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-[#EDE8F8] bg-white/70 px-4 py-3">
                    <dt className="text-xs font-medium text-[#667085]">Baskın biçim</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#172033]">
                      {dominantLabel ?? '—'}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-[#EDE8F8] bg-white/70 px-4 py-3">
                    <dt className="text-xs font-medium text-[#667085]">En dikkat çekici değişim</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[#172033]">
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

            <RelationshipInsightNote body={metrics.insightNote} />
            <div className="grid gap-4 md:grid-cols-3">
              <BehaviorToneBars
                title="AI Davranış Haritası"
                subtitle="AI sana en çok şu tonlarda yanıt verdi."
                bars={metrics.aiBehaviorBars}
              />
              <ActiveTimeCard buckets={metrics.activeTimeBuckets} />
              <InteractionDepthCard metric={metrics.interactionDepth} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
