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
  buildEditorialReadabilityVars,
  getEditorialContrast,
} from '@/lib/eza/mirror/posterReadabilitySystem';
import {
  POSTER_CARD_WIDTH_PX,
  posterCardSkin as s,
  posterTextShadowStyle,
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

function MetricStrip({ label, line }: { label: string; line: string }) {
  return (
    <div className={s.relationCell}>
      <p className={s.relationLabel} style={posterTextShadowStyle.relationLabel}>
        {label}
      </p>
      <p className={s.relationLine} style={posterTextShadowStyle.relationLine}>
        {line}
      </p>
    </div>
  );
}

/**
 * Editorial cinematic poster — confident contrast, gradient-first readability.
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
  const editorial = useMemo(
    () => getEditorialContrast(composition.density),
    [composition.density]
  );
  const cardStyle = useMemo(
    () => ({
      maxWidth: POSTER_CARD_WIDTH_PX,
      ...buildPosterCompositionStyle(composition),
      ...buildEditorialReadabilityVars(editorial),
    }),
    [composition, editorial]
  );
  const highlightEmphasis = useMemo(
    () => highlightEmphasisFor(composition.density, content.contextualHighlight.kind),
    [composition.density, content.contextualHighlight.kind]
  );

  const sen = content.activities.find((a) => a.label === 'Sen');
  const ai = content.activities.find((a) => a.label === 'AI');
  const balance = content.activities.find((a) => a.label === 'Denge');

  const bottomFadeOpacity = editorial.bottomFade;

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect="9-16"
      data-mirror-poster="v7-editorial-contrast"
      data-mirror-density={composition.density}
      className={s.root}
      style={cardStyle}
      aria-labelledby="daily-mirror-poster-title"
    >
      <DailyMirrorPosterScene
        className={s.sceneBackdrop}
        personaFamilyId={card.personaFamilyId}
        sceneImageUrl={card.visual?.sceneImageUrl}
        sceneImageStatus={card.visual?.sceneImageStatus}
        sceneFilter={{
          brightness: editorial.sceneBrightness,
          contrast: editorial.sceneContrast,
          saturate: editorial.sceneSaturate,
        }}
        onSceneImageLoad={onSceneImageLoad}
        onSceneImageError={onSceneImageError}
      />

      <div className={s.globalOverlay} aria-hidden />
      <div
        className={cn(s.globalOverlayBottom, 'bg-gradient-to-t from-[#0a0614] via-[#140a22]/40 to-transparent')}
        style={{ opacity: bottomFadeOpacity }}
        aria-hidden
      />
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
            <Calendar className="mr-0.5 inline h-2 w-2 opacity-80" aria-hidden />
            {card.dayLabel}
          </p>
        </header>

        <div className={s.titleSafeZone}>
          <h2
            id="daily-mirror-poster-title"
            className={s.heroTitle}
            style={posterTextShadowStyle.heroTitle}
          >
            {isSparse ? 'Yansıma hazırlanıyor' : content.journeyHeadline}
          </h2>
          <div className={s.storyWrap}>
            <p className={s.story} style={posterTextShadowStyle.story}>
              {isSparse ? MIRROR_INSUFFICIENT : content.storyLine}
            </p>
          </div>
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
            <p className={s.quoteText} style={posterTextShadowStyle.quoteText}>
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
              <MetricStrip label="Sen" line={sen?.value ?? '—'} />
              <MetricStrip label="AI" line={ai?.value ?? '—'} />
              <MetricStrip label="Denge" line={balance?.value ?? '—'} />
            </div>
          ) : null}

          <footer className={s.footer}>
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
