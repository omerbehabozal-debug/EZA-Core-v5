'use client';

/**
 * @deprecated Sprint 11E — legacy observation card layout.
 * Günlük Ayna uses {@link DailyMirrorPosterCard} only (`StandaloneObservationExperience`).
 */

import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MIRROR_LABELS } from '@/lib/eza/presentationTone';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import {
  MIRROR_DAILY_INTRO,
  MIRROR_DAILY_PRIVACY_HINT,
  MIRROR_INSUFFICIENT,
  MIRROR_PRIVACY_SHORT,
  MIRROR_SPARSE_ENERGY_HINT,
} from '@/lib/eza/mirror/copy';
import DailyMirrorScene from '@/components/mirror/DailyMirrorScene';
import MirrorVisualPromptDebug from '@/components/mirror/MirrorVisualPromptDebug';

export type DailyMirrorCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

function energyBarWidth(score: number | null): number {
  if (score === null) return 0;
  return Math.max(8, Math.min(100, score));
}

function MirrorRow({
  label,
  sentence,
  muted,
}: {
  label: string;
  sentence: string;
  muted?: boolean;
}) {
  if (!sentence.trim()) return null;
  return (
    <div className={cn('space-y-1', muted && 'opacity-70')}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
        {label}
      </p>
      <p className="text-[15px] leading-relaxed text-stone-800 sm:text-[16px]">{sentence}</p>
    </div>
  );
}

export default function DailyMirrorCard({
  card,
  meta,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorCardProps) {
  const labels = MIRROR_LABELS.standalone;
  const isReady =
    Boolean(meta?.hasEnoughData) && card.shareEnabled && Boolean(card.characterName);
  const isSparse = !isReady;

  const heroTitle = useMemo(() => {
    if (card.characterName.trim()) {
      return `Bugün sen ${card.characterName} enerjisinde görünüyorsun`;
    }
    return card.headline || 'Bugünün AI aynası';
  }, [card.characterName, card.headline]);

  return (
    <article
      data-mirror-card-root
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white via-white to-violet-50/30',
        'shadow-[0_20px_60px_-24px_rgba(99,102,241,0.22)]',
        isSparse && 'shadow-[0_12px_40px_-20px_rgba(148,163,184,0.35)]'
      )}
      aria-labelledby="daily-mirror-title"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-violet-100/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-sky-100/50 blur-3xl"
        aria-hidden
      />

      <div className="relative space-y-6 p-5 sm:p-7 md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-700">
              <Sparkles className="h-3 w-3" aria-hidden />
              EZA Mirror
            </p>
            <p className="text-xs text-stone-500">{card.dayLabel}</p>
            <p className="max-w-prose text-xs leading-relaxed text-stone-500">
              {MIRROR_DAILY_INTRO}
            </p>
          </div>
        </header>

        <div className="space-y-3">
          <h2
            id="daily-mirror-title"
            className="text-2xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-[1.65rem]"
          >
            {heroTitle}
          </h2>
          {card.characterName && !isSparse ? (
            <p className="text-sm font-medium text-violet-700/90">{card.characterName}</p>
          ) : null}
          <p
            className={cn(
              'max-w-prose text-[15px] leading-relaxed text-stone-600 sm:text-base',
              isSparse && 'text-stone-500'
            )}
          >
            {isSparse ? MIRROR_INSUFFICIENT : card.shortInsight}
          </p>
          {!isSparse ? (
            <p className="text-xs text-stone-500">{MIRROR_DAILY_PRIVACY_HINT}</p>
          ) : null}
        </div>

        <DailyMirrorScene
          personaFamilyId={card.personaFamilyId}
          characterName={card.characterName}
          sceneImageUrl={card.visual?.sceneImageUrl}
          sceneImageStatus={card.visual?.sceneImageStatus}
          subdued={isSparse}
          onSceneImageLoad={onSceneImageLoad}
          onSceneImageError={onSceneImageError}
        />

        <div
          className={cn(
            'grid gap-4 rounded-2xl border border-stone-100/80 bg-white/60 p-4 backdrop-blur-sm sm:grid-cols-3 sm:gap-5 sm:p-5',
            isSparse && 'sm:grid-cols-1'
          )}
        >
          <MirrorRow label={labels.user} sentence={card.userLine} muted={isSparse} />
          <MirrorRow label={labels.ai} sentence={card.aiLine} muted={isSparse} />
          <MirrorRow label={labels.balance} sentence={card.balanceLine} muted={isSparse} />
        </div>

        {!isSparse ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-stone-50/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Ritim
                </p>
                <p className="text-sm font-medium text-stone-800">{card.energyLabel}</p>
              </div>
              {card.energyScore !== null ? (
                <div
                  className="h-2 overflow-hidden rounded-full bg-stone-200/80"
                  role="progressbar"
                  aria-valuenow={card.energyScore}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Ritim düzeyi ${card.energyScore}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-300 via-sky-300 to-teal-300 transition-[width] duration-500"
                    style={{ width: `${energyBarWidth(card.energyScore)}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-200/90 bg-stone-50/50 px-4 py-3 text-center text-sm text-stone-500">
            {MIRROR_SPARSE_ENERGY_HINT}
          </p>
        )}

        <footer className="border-t border-stone-100/90 pt-4">
          <p className="text-xs leading-relaxed text-stone-500">{MIRROR_PRIVACY_SHORT}</p>
        </footer>

        <MirrorVisualPromptDebug visual={card.visual} />
      </div>
    </article>
  );
}
