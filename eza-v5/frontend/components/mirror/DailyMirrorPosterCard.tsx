'use client';

import { useMemo, type ReactNode } from 'react';
import { Calendar, Heart, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import { MIRROR_INSUFFICIENT } from '@/lib/eza/mirror/copy';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import {
  buildPosterCompositionStyle,
  getPosterComposition,
  highlightEmphasisFor,
} from '@/lib/eza/mirror/posterCompositionSystem';
import { buildPosterEditorialCssVars } from '@/lib/eza/mirror/posterEditorialMathematics';
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
import MirrorLiveDebugPanel from '@/components/mirror/MirrorLiveDebugPanel';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  entries?: SavedBehavioralEntry[];
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
  onForceBmwMercedes?: () => void;
};

function InsightGlassCard({
  label,
  line,
  icon,
}: {
  label: string;
  line: string;
  icon: ReactNode;
}) {
  return (
    <div className={s.insightCard}>
      <div className={s.insightIcon}>{icon}</div>
      <p className={s.insightLabel} style={posterTextShadowStyle.insightLabel}>
        {label}
      </p>
      <p className={s.insightLine} style={posterTextShadowStyle.insightLine}>
        {line}
      </p>
    </div>
  );
}

/**
 * Premium editorial poster template — fixed layout, AI scene layer only.
 */
export default function DailyMirrorPosterCard({
  card,
  meta,
  entries = [],
  onSceneImageLoad,
  onSceneImageError,
  onForceBmwMercedes,
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
      ...buildPosterEditorialCssVars(),
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

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect="9-16"
      data-mirror-poster="v8b-intent-lock"
      data-mirror-density={composition.density}
      className={s.root}
      style={cardStyle}
      aria-labelledby="daily-mirror-poster-title"
    >
      <DailyMirrorPosterScene
        className={cn(s.sceneBackdrop, s.sceneBreathing)}
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
      <div className={s.globalOverlayBottom} aria-hidden />
      <div className={s.grain} aria-hidden />
      <div className={s.accentGlow} aria-hidden />

      <div
        className={s.contentStack}
        style={{ gridTemplateRows: 'var(--poster-zone-rows)' }}
      >
        <header className={cn(s.topSafeZone, s.editorialGrid)}>
          <p className={cn(s.logoText, 'col-span-8 flex items-center gap-1.5')}>
            <span className={s.logoMark}>
              <Sparkles className="h-2 w-2" strokeWidth={1.75} aria-hidden />
            </span>
            EZA · AI İlişki Aynası
          </p>
          <p className={cn(s.datePill, 'col-span-4 text-right')}>
            <Calendar className="mr-0.5 inline h-2 w-2 opacity-80" aria-hidden />
            {card.dayLabel}
          </p>
        </header>

        <div className={cn(s.titleSafeZone, s.editorialGrid)}>
          <h2
            id="daily-mirror-poster-title"
            className={s.heroTitle}
            style={posterTextShadowStyle.heroTitle}
          >
            {isSparse ? 'Yansıma hazırlanıyor' : content.journeyHeadline}
          </h2>
          <div className={cn(s.storyWrap, 'col-span-12')}>
            <p className={s.story} style={posterTextShadowStyle.story}>
              {isSparse ? MIRROR_INSUFFICIENT : content.storyLine}
            </p>
          </div>
        </div>

        <div className={cn(s.sceneSpacer, s.editorialGrid)} aria-hidden={isSparse}>
          {!isSparse ? (
            <div className={cn(s.highlightAnchor, 'col-span-12')}>
              <ContextualHighlightBand
                highlight={content.contextualHighlight}
                emphasis={highlightEmphasis}
              />
            </div>
          ) : null}
        </div>

        <div className={cn(s.quoteZone, s.editorialGrid)}>
          {!isSparse ? (
            <p
              className={cn(s.quoteText, 'col-span-12')}
              style={posterTextShadowStyle.quoteText}
            >
              <span className={s.quoteMark} aria-hidden>
                “
              </span>
              {content.quote}
              <span className={s.quoteMark} aria-hidden>
                ”
              </span>
            </p>
          ) : null}
        </div>

        {!isSparse ? (
          <div className={cn(s.insightsRow, s.editorialGrid)}>
            <InsightGlassCard
              label="Sen"
              line={sen?.value ?? '—'}
              icon={<User className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
            <InsightGlassCard
              label="AI"
              line={ai?.value ?? '—'}
              icon={<Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
            <InsightGlassCard
              label="Denge"
              line={balance?.value ?? '—'}
              icon={<Heart className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
          </div>
        ) : null}

        <footer className={cn(s.footer, s.editorialGrid)}>
          <span className="col-span-4">EZA</span>
          <span className="col-span-4 text-center">#EZAİlişkiAynası</span>
          <span className="col-span-4 text-right">eza.ai</span>
        </footer>
      </div>

      <MirrorLiveDebugPanel
        card={card}
        entries={entries}
        meta={meta}
        posterVersion="v8b-intent-lock"
        onForceBmwMercedes={onForceBmwMercedes}
      />
    </article>
  );
}
