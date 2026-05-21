'use client';

import { useMemo } from 'react';
import { Calendar, Sparkles, User, Bot, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { MIRROR_INSUFFICIENT } from '@/lib/eza/mirror/copy';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import {
  POSTER_CARD_WIDTH_PX,
  posterCardSkin as s,
} from '@/lib/eza/mirror/posterCardSkin';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';
import MirrorVisualPromptDebug from '@/components/mirror/MirrorVisualPromptDebug';

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

const RELATION_ICONS = {
  Sen: User,
  AI: Bot,
  Denge: Scale,
} as const;

function RelationBlock({
  label,
  line,
  percent,
}: {
  label: string;
  line: string;
  percent: number;
}) {
  const Icon = RELATION_ICONS[label as keyof typeof RELATION_ICONS] ?? User;
  return (
    <div className={s.relationCell}>
      <p className={s.relationLabel}>
        <Icon className="h-1.5 w-1.5 shrink-0 opacity-80" aria-hidden />
        {label}
      </p>
      <p className={s.relationLine}>{line}</p>
      <div className={s.relationBar} aria-hidden>
        <div className={s.relationBarFill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Visual-dominant 9:16 Daily Mirror poster — full-bleed scene + glass overlays.
 */
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

  const sen = content.activities.find((a) => a.label === 'Sen');
  const ai = content.activities.find((a) => a.label === 'AI');
  const balance = content.activities.find((a) => a.label === 'Denge');
  const bars = content.relationshipBars;

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect="9-16"
      data-mirror-poster="v3-visual-dominant"
      className={s.root}
      style={{ maxWidth: POSTER_CARD_WIDTH_PX }}
      aria-labelledby="daily-mirror-poster-title"
    >
      <DailyMirrorPosterScene
        className={s.sceneBackdrop}
        personaFamilyId={card.personaFamilyId}
        sceneImageUrl={card.visual?.sceneImageUrl}
        sceneImageStatus={card.visual?.sceneImageStatus}
        onSceneImageLoad={onSceneImageLoad}
        onSceneImageError={onSceneImageError}
      />

      <div className={s.globalOverlay} aria-hidden />
      <div className={s.globalOverlayBottom} aria-hidden />
      <div className={s.grain} aria-hidden />
      <div className={s.vignette} aria-hidden />

      <div className={s.contentStack}>
        <header className={s.header}>
          <div className="space-y-0.5">
            <p className={cn(s.logoText, 'flex items-center gap-1.5')}>
              <span className={s.logoMark}>
                <Sparkles className="h-2.5 w-2.5" strokeWidth={1.75} aria-hidden />
              </span>
              EZA
            </p>
            <p className={s.logoSub}>AI İlişki Aynası</p>
          </div>
          <div className={s.datePill}>
            <Calendar className="h-2 w-2 shrink-0 opacity-90" aria-hidden />
            <span className="truncate">{card.dayLabel}</span>
          </div>
        </header>

        <div className={s.headlineZone}>
          <h2
            id="daily-mirror-poster-title"
            className={cn(
              s.heroTitle,
              !isSparse &&
                'bg-gradient-to-r from-white via-violet-50 to-fuchsia-100 bg-clip-text text-transparent',
              isSparse && 'text-white/90'
            )}
          >
            {isSparse ? 'Yansıma hazırlanıyor' : content.journeyHeadline}
          </h2>
        </div>

        <div className={s.bottomStack}>
          <div className={s.glass}>
            <p className={s.story}>{isSparse ? MIRROR_INSUFFICIENT : content.storyLine}</p>
          </div>

          {!isSparse ? (
            <>
              <div className={s.glassTheme}>
                <p className={s.themeLabel}>
                  <span aria-hidden>{content.characterEmoji}</span>
                  <span className="ml-1">{content.themeTitle}</span>
                </p>
                <p className={s.themeDesc}>{content.themeDescription}</p>
              </div>

              <div className={s.quoteWrap}>
                <p className={s.quoteText}>
                  <span className={s.quoteMark} aria-hidden>
                    “
                  </span>
                  {content.quote}
                  <span className={s.quoteMark} aria-hidden>
                    ”
                  </span>
                </p>
              </div>

              <div className={s.metricsGlass}>
                <RelationBlock
                  label="Sen"
                  line={sen?.value ?? '—'}
                  percent={bars[0]?.percent ?? content.energyPercent}
                />
                <RelationBlock
                  label="AI"
                  line={ai?.value ?? '—'}
                  percent={bars[1]?.percent ?? Math.min(95, content.energyPercent + 4)}
                />
                <RelationBlock
                  label="Denge"
                  line={balance?.value ?? '—'}
                  percent={bars[2]?.percent ?? Math.max(30, content.energyPercent - 8)}
                />
              </div>
            </>
          ) : null}

          <footer className={s.footer}>
            <span className="font-semibold text-white/70">EZA</span>
            <span>#EZAİlişkiAynası</span>
            <span className="text-white/45">eza.ai</span>
          </footer>
        </div>
      </div>

      <MirrorVisualPromptDebug visual={card.visual} />
    </article>
  );
}
