'use client';

import { useMemo } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { MIRROR_INSUFFICIENT } from '@/lib/eza/mirror/copy';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import {
  buildPosterCompositionStyle,
  getPosterComposition,
  highlightEmphasisFor,
} from '@/lib/eza/mirror/posterCompositionSystem';
import {
  POSTER_CARD_WIDTH_PX,
  posterCardSkin as s,
} from '@/lib/eza/mirror/posterCardSkin';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';
import ContextualHighlightBand from '@/components/mirror/ContextualHighlightBand';
import MirrorVisualPromptDebug from '@/components/mirror/MirrorVisualPromptDebug';

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
};

function MetricWhisper({ label, line }: { label: string; line: string }) {
  return (
    <div className={s.relationCell}>
      <p className={s.relationLabel}>{label}</p>
      <p className={s.relationLine}>{line}</p>
    </div>
  );
}

/**
 * Cinematic poster composition — scene · editorial type · whisper support.
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
  const composition = useMemo(() => getPosterComposition(card), [card]);
  const compositionStyle = useMemo(
    () => buildPosterCompositionStyle(composition),
    [composition]
  );
  const highlightEmphasis = useMemo(
    () => highlightEmphasisFor(composition.density, content.contextualHighlight.kind),
    [composition.density, content.contextualHighlight.kind]
  );

  const sen = content.activities.find((a) => a.label === 'Sen');
  const ai = content.activities.find((a) => a.label === 'AI');
  const balance = content.activities.find((a) => a.label === 'Denge');

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect="9-16"
      data-mirror-poster="v6-composition"
      data-mirror-density={composition.density}
      className={s.root}
      style={{ maxWidth: POSTER_CARD_WIDTH_PX, ...compositionStyle }}
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

      <div
        className={s.contentStack}
        style={{ gridTemplateRows: 'var(--poster-grid-rows)' }}
      >
        <header className={s.topSafeZone}>
          <p className={cn(s.logoText, 'flex items-center gap-1.5')}>
            <span className={s.logoMark}>
              <Sparkles className="h-2 w-2" strokeWidth={1.75} aria-hidden />
            </span>
            EZA · AI İlişki Aynası
          </p>
          <p className={s.datePill}>
            <Calendar className="mr-0.5 inline h-2 w-2 opacity-70" aria-hidden />
            {card.dayLabel}
          </p>
        </header>

        <div className={s.titleSafeZone}>
          <h2 id="daily-mirror-poster-title" className={s.heroTitle}>
            {isSparse ? 'Yansıma hazırlanıyor' : content.journeyHeadline}
          </h2>
          <p className={s.story}>
            {isSparse ? MIRROR_INSUFFICIENT : content.storyLine}
          </p>
        </div>

        <div className={s.sceneAnchor} aria-hidden={isSparse}>
          {!isSparse ? (
            <div className={s.highlightAnchor}>
              <ContextualHighlightBand
                highlight={content.contextualHighlight}
                emphasis={highlightEmphasis}
              />
            </div>
          ) : null}
        </div>

        <div className={s.bottomSafeZone}>
          {!isSparse ? (
            <p className={s.quoteText}>
              <span className={s.quoteMark} aria-hidden>
                “
              </span>
              {content.quote}
              <span className={s.quoteMark} aria-hidden>
                ”
              </span>
            </p>
          ) : null}

          {!isSparse ? (
            <div className={s.metricsRow}>
              <MetricWhisper label="Sen" line={sen?.value ?? '—'} />
              <MetricWhisper label="AI" line={ai?.value ?? '—'} />
              <MetricWhisper label="Denge" line={balance?.value ?? '—'} />
            </div>
          ) : null}

          <footer className={cn(s.footer, 'px-0 pb-0')}>
            <span>EZA</span>
            <span>#EZAİlişkiAynası</span>
            <span>eza.ai</span>
          </footer>
        </div>
      </div>

      <MirrorVisualPromptDebug visual={card.visual} />
    </article>
  );
}
