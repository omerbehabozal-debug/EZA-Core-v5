'use client';

import { useMemo, useState } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { MirrorStateMeta } from '@/lib/eza/mirror/types';
import {
  buildRelationshipDashboardMetrics,
  RELATIONSHIP_PERIOD_OPTIONS,
  type RelationshipPeriodFilter,
} from '@/lib/eza/mirror/relationshipPatternMetrics';
import { MIRROR_PRIVACY_SHORT } from '@/lib/eza/mirror/copy';
import BehaviorIslandsMap from '@/components/mirror/relationship/BehaviorIslandsMap';
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

export default function RelationshipPatternView({
  entries,
  className,
}: RelationshipPatternViewProps) {
  const [period, setPeriod] = useState<RelationshipPeriodFilter>(30);
  const [fadeKey, setFadeKey] = useState(0);
  const reducedMotion = useReducedMotion();

  const metrics = useMemo(
    () => buildRelationshipDashboardMetrics(entries, period),
    [entries, period]
  );

  const handlePeriod = (value: RelationshipPeriodFilter) => {
    if (value === period) return;
    setPeriod(value);
    setFadeKey((k) => k + 1);
  };

  const anim = (cls: string) => (!reducedMotion ? cls : '');
  const balanceScore =
    metrics.interactionDepth.score != null
      ? Math.round((metrics.interactionDepth.score / 10) * 100)
      : 68;

  return (
    <section
      className={cn('relative mx-auto w-full max-w-[1120px] space-y-8', className)}
      aria-label="AI İlişki Deseni"
    >
      <div
        className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-violet-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 bottom-40 h-52 w-52 rounded-full bg-amber-100/35 blur-3xl"
        aria-hidden
      />

      <header className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#172033] sm:text-[1.65rem]">
            <Sparkles className="h-5 w-5 text-[#7B61FF]/80" strokeWidth={1.5} aria-hidden />
            EZA İlişki Haritası
            <span className="text-[#7B61FF]/70" aria-hidden>
              ✦
            </span>
          </h2>
          <p className="max-w-lg text-sm leading-relaxed text-[#667085]">
            AI ile konuşma yolculuğunun uzun dönem deseni.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <div
            className="inline-flex rounded-full border border-violet-100/90 bg-white/80 p-1 shadow-sm backdrop-blur-sm"
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
                  'rounded-full px-3.5 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm',
                  period === p.value
                    ? 'bg-gradient-to-r from-[#7B61FF] to-[#9B84FF] text-white shadow-md shadow-violet-300/40'
                    : 'text-[#667085] hover:bg-violet-50/80 hover:text-[#172033]'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-violet-100/80 bg-white/70 text-[#7B61FF]/70"
            aria-hidden
          >
            <Calendar className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </div>
      </header>

      <div className="relative grid gap-6 lg:grid-cols-[1fr_minmax(260px,300px)] lg:items-start">
        <div key={fadeKey} className={cn('space-y-6', anim('animate-in fade-in duration-500'))}>
          <section
            className="rounded-[2rem] border border-white/90 bg-gradient-to-b from-white/95 via-[#F8F6F1]/60 to-violet-50/30 p-5 shadow-[0_20px_60px_-24px_rgba(123,97,255,0.22)] sm:p-8"
            aria-labelledby="behavior-islands-title"
          >
            <div className="mb-5 space-y-1">
              <h3
                id="behavior-islands-title"
                className="text-lg font-semibold text-[#172033]"
              >
                Davranış Adaların
              </h3>
              <p className="text-sm text-[#667085]">
                Her ada, konuşma biçimindeki eğilimlerini temsil eder.
              </p>
            </div>

            {metrics.isEmpty ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-dashed border-violet-200/80 bg-white/50 px-4 py-3 text-center">
                  <p className="text-sm font-medium text-[#172033]">Desen henüz oluşmadı.</p>
                  <p className="mt-1 text-xs text-[#667085]">
                    AI ile birkaç sohbetten sonra burada davranış adaların belirecek.
                  </p>
                </div>
                <BehaviorIslandsMap islands={metrics.ghostIslands} ghost />
              </div>
            ) : (
              <BehaviorIslandsMap islands={metrics.islands} />
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <BehaviorToneBars
              title="AI Davranış Haritası"
              subtitle="AI sana en çok şu tonlarda yanıt verdi."
              bars={metrics.aiBehaviorBars}
            />
            <RelationshipBalanceBars bars={metrics.balanceBars} />
            <RelationshipTimelineChart points={metrics.timelinePoints} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <RelationshipInsightNote body={metrics.insightNote} />
            <ActiveTimeCard buckets={metrics.activeTimeBuckets} />
            <InteractionDepthCard metric={metrics.interactionDepth} />
          </div>
        </div>

        <aside className="lg:sticky lg:top-4">
          <RelationshipSummaryCard
            label={metrics.generalBalanceLabel}
            hint={
              metrics.generalBalanceHint ||
              'Etkileşimlerin sağlıklı bir ritimde ilerliyor.'
            }
            scorePercent={balanceScore}
          />
          {metrics.isSparse && !metrics.isEmpty ? (
            <p className="mt-3 text-center text-xs text-[#667085]">
              Desen sinyali güçleniyor — birkaç etkileşim daha netleştirir.
            </p>
          ) : null}
        </aside>
      </div>

      <footer className="border-t border-stone-100/90 pt-4">
        <p className="text-center text-xs leading-relaxed text-[#667085]">{MIRROR_PRIVACY_SHORT}</p>
        {metrics.pattern.confidence && !metrics.isEmpty ? (
          <p className="mt-2 text-center text-[10px] text-[#667085]/80">
            {metrics.pattern.confidence}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
