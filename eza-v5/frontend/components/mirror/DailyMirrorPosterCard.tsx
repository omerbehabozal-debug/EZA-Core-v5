'use client';

import { useId, useMemo } from 'react';
import {
  Calendar,
  Heart,
  Sparkles,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { MIRROR_INSUFFICIENT } from '@/lib/eza/mirror/copy';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';
import MirrorVisualPromptDebug from '@/components/mirror/MirrorVisualPromptDebug';

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

function EnergyRing({ percent, label }: { percent: number; label: string }) {
  const gradId = useId();
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-[5.5rem] w-[5.5rem]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88" aria-hidden>
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="rgb(233 213 255)"
            strokeWidth="8"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Heart className="h-4 w-4 text-violet-600" aria-hidden />
        </div>
      </div>
      <p className="text-center text-[10px] font-bold uppercase tracking-wider text-violet-800">
        {label}
      </p>
    </div>
  );
}

function MetricBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-medium text-violet-900/80">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default function DailyMirrorPosterCard({
  card,
  meta,
  onSceneImageLoad,
  onSceneImageError,
}: DailyMirrorPosterCardProps) {
  const isReady =
    Boolean(meta?.hasEnoughData) && card.shareEnabled && Boolean(card.characterName);
  const isSparse = !isReady;
  const content = useMemo(() => buildPosterCardContent(card), [card]);

  return (
    <article
      data-mirror-card-root
      className={cn(
        'relative mx-auto w-full max-w-[400px] overflow-hidden rounded-[1.75rem]',
        'border border-violet-200/60 shadow-[0_24px_64px_-20px_rgba(91,33,182,0.35)]',
        'bg-[#faf7ff]'
      )}
      style={{ aspectRatio: '9 / 16' }}
      aria-labelledby="daily-mirror-poster-title"
    >
      <div className="relative flex h-[58%] min-h-0 flex-col">
        <DailyMirrorPosterScene
          personaFamilyId={card.personaFamilyId}
          sceneImageUrl={card.visual?.sceneImageUrl}
          sceneImageStatus={card.visual?.sceneImageStatus}
          onSceneImageLoad={onSceneImageLoad}
          onSceneImageError={onSceneImageError}
        />

        <div className="relative z-10 flex flex-1 flex-col p-4 pb-2 sm:p-5">
          <header className="flex items-start justify-between gap-2">
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-white drop-shadow-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden />
                </span>
                EZA
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
                AI İlişki Aynası
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
              <span className="max-w-[7rem] truncate">{card.dayLabel}</span>
            </div>
          </header>

          <div className="mt-auto max-w-[92%] space-y-2 pb-1 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/85">
              Günlük Mirror Kartın
            </p>
            <p className="text-sm font-medium text-white/95">Bugün sen</p>
            <h2
              id="daily-mirror-poster-title"
              className="flex flex-wrap items-center gap-1.5 text-[1.65rem] font-bold leading-tight drop-shadow-sm sm:text-3xl"
            >
              <span aria-hidden>{content.characterEmoji}</span>
              <span
                className={cn(
                  'bg-gradient-to-r bg-clip-text text-transparent',
                  content.characterGradient
                )}
              >
                {card.characterName || 'Yolcu'}
              </span>
            </h2>
            <p className="text-xs leading-relaxed text-white/90 sm:text-[13px]">
              {isSparse ? MIRROR_INSUFFICIENT : content.description}
            </p>

            {!isSparse ? (
              <div className="mt-2 max-w-[16rem] rounded-xl border border-white/25 bg-violet-900/35 px-3 py-2.5 backdrop-blur-md">
                <p className="text-[9px] font-bold uppercase tracking-wider text-violet-200">
                  Bugünün teması
                </p>
                <p className="mt-0.5 text-xs font-bold text-white">{content.themeTitle}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/85">
                  {content.themeDescription}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!isSparse ? (
        <div className="relative z-10 -mt-1 px-3 sm:px-4">
          <div className="rounded-xl border border-violet-100/80 bg-[#f3ecff]/95 px-4 py-3 text-center shadow-sm">
            <span className="text-2xl font-serif leading-none text-violet-400" aria-hidden>
              “
            </span>
            <p className="text-xs italic leading-relaxed text-violet-900/90 sm:text-[13px]">
              {content.quote}
            </p>
            <span className="text-2xl font-serif leading-none text-violet-400" aria-hidden>
              ”
            </span>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'relative z-10 flex flex-1 flex-col gap-3 px-3 pb-4 pt-3 sm:px-4',
          isSparse && 'pt-6'
        )}
      >
        {!isSparse ? (
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
            <section className="rounded-xl border border-violet-100/90 bg-white/80 p-3 shadow-sm">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                <Users className="h-3 w-3" aria-hidden />
                Bugün ne yaptın?
              </p>
              <ul className="space-y-2">
                {content.activities.map((row) => (
                  <li key={row.label} className="space-y-0.5">
                    <p className="text-[9px] font-semibold uppercase text-violet-500">
                      {row.label}
                    </p>
                    <p className="text-[11px] leading-snug text-violet-950/85">{row.value}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col items-center justify-center rounded-xl border border-violet-100/90 bg-white/80 p-3 shadow-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                Ritim
              </p>
              <EnergyRing percent={content.energyPercent} label={content.energyDisplay} />
            </section>

            <section className="rounded-xl border border-violet-100/90 bg-white/80 p-3 shadow-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-800">
                İlişki dengen
              </p>
              <div className="space-y-2.5">
                {content.relationshipBars.map((bar) => (
                  <MetricBar key={bar.label} label={bar.label} percent={bar.percent} />
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-violet-700/80">
                {content.relationshipNote}
              </p>
            </section>
          </div>
        ) : null}

        <footer className="rounded-xl border border-violet-200/50 bg-gradient-to-r from-violet-900/90 to-violet-800/90 px-3 py-2.5 text-white shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-200">
            Yarının hint&apos;i
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/95">{content.tomorrowHint}</p>
        </footer>

        <MirrorVisualPromptDebug visual={card.visual} />
      </div>
    </article>
  );
}
