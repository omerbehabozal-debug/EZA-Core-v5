'use client';

import { useMemo } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyMirrorCardModel, MirrorStateMeta } from '@/lib/eza/mirror/types';
import {
  buildPosterCardContent,
  resolvePosterIdentityDisplay,
} from '@/lib/eza/mirror/posterCardContent';
import {
  buildPosterCompositionStyle,
  getPosterComposition,
} from '@/lib/eza/mirror/posterCompositionSystem';
import { buildPosterEditorialCssVars } from '@/lib/eza/mirror/posterEditorialMathematics';
import {
  buildEditorialReadabilityVars,
  getEditorialContrast,
} from '@/lib/eza/mirror/posterReadabilitySystem';
import { POSTER_CARD_WIDTH_PX, getPosterCardSkin } from '@/lib/eza/mirror/posterCardSkin';
import {
  buildPremiumPosterCssVars,
  premiumPosterRootStyle,
  resolvePosterPalette,
} from '@/lib/eza/mirror/posterPaletteSystem';
import PosterIdentityHeadline from '@/components/mirror/PosterIdentityHeadline';
import PosterSceneWindow from '@/components/mirror/PosterSceneWindow';
import PosterReflectionSummary from '@/components/mirror/PosterReflectionSummary';
import PosterTomorrowHint from '@/components/mirror/PosterTomorrowHint';
import MirrorLiveDebugPanel from '@/components/mirror/MirrorLiveDebugPanel';
import {
  buildMirrorLayoutDebug,
  resolveCardRenderMode,
  resolveEffectiveRenderMode,
  shouldUseHybridPosterLayout,
} from '@/lib/eza/mirror/mirrorPosterLayout';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  entries?: SavedBehavioralEntry[];
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
  onForceBmwMercedes?: () => void;
  onToggleHybridMode?: () => void;
  hybridTextFallback?: boolean;
};

/**
 * P2 rev — metinsel kimlik + baskın sahne penceresi (avatar görseli yok).
 */
export default function DailyMirrorPosterCard({
  card,
  meta,
  entries = [],
  onSceneImageLoad,
  onSceneImageError,
  onForceBmwMercedes,
  onToggleHybridMode,
  hybridTextFallback = false,
}: DailyMirrorPosterCardProps) {
  const isReady =
    Boolean(meta?.hasEnoughData) &&
    card.shareEnabled &&
    Boolean(card.dailyAvatarName?.trim() || card.characterName?.trim());
  const isSparse = !isReady;
  const cardRenderMode = resolveCardRenderMode(card);
  const effectiveRenderMode = resolveEffectiveRenderMode(card, hybridTextFallback);
  const showHybridFallback =
    hybridTextFallback || Boolean(card.visual?.hybridFallbackReason);
  const isHybridMiddle = shouldUseHybridPosterLayout(
    effectiveRenderMode,
    showHybridFallback
  );
  const layoutDebug = useMemo(
    () =>
      buildMirrorLayoutDebug({
        card,
        explicitHybridFallback: showHybridFallback,
        sceneImageUrl: card.visual?.sceneImageUrl,
        sceneImageStatus: card.visual?.sceneImageStatus,
      }),
    [card, showHybridFallback]
  );
  const posterVersion = isHybridMiddle ? 'v9b-scene-hero-hybrid' : 'v9b-scene-hero';
  const content = useMemo(() => buildPosterCardContent(card), [card]);
  const identity = useMemo(
    () => resolvePosterIdentityDisplay(card, content),
    [card, content]
  );
  const composition = useMemo(
    () =>
      getPosterComposition(
        card,
        isHybridMiddle ? 'identity_hybrid' : 'identity_first'
      ),
    [card, isHybridMiddle]
  );
  const editorial = useMemo(
    () => getEditorialContrast(composition.density),
    [composition.density]
  );
  const palette = useMemo(() => resolvePosterPalette(card), [card]);
  const skin = useMemo(() => getPosterCardSkin(palette, 'identity_first'), [palette]);
  const cardStyle = useMemo(
    () => ({
      maxWidth: POSTER_CARD_WIDTH_PX,
      width: '100%',
      ...buildPosterEditorialCssVars(),
      ...buildPosterCompositionStyle(composition),
      ...buildPremiumPosterCssVars(),
      ...premiumPosterRootStyle(),
      ...buildEditorialReadabilityVars(editorial),
    }),
    [composition, editorial]
  );

  const reflectionProps = {
    journeyHeadline: content.journeyHeadline,
    storyLine: isHybridMiddle ? '' : content.storyLine,
    quote: isHybridMiddle ? '' : content.quote,
    activities: content.activities,
    relationshipBars: content.relationshipBars,
    energyLabel: content.energyDisplay,
    energyPercent: content.energyPercent,
    skin,
    isSparse,
  };

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect="9-16"
      data-mirror-poster={posterVersion}
      data-mirror-render-mode={cardRenderMode}
      data-mirror-effective-render-mode={effectiveRenderMode}
      data-mirror-used-layout={layoutDebug.usedLayout}
      data-mirror-palette={palette}
      data-mirror-density={composition.density}
      className={skin.root}
      style={cardStyle}
      aria-labelledby="daily-mirror-poster-title"
    >
      <div className={skin.accentGlow} aria-hidden />
      <div className={skin.grain} aria-hidden />

      <div
        className={skin.contentStack}
        style={{ gridTemplateRows: 'var(--poster-zone-rows)' }}
      >
        <header className={cn(skin.topSafeZone, 'col-span-12 flex items-start justify-between')}>
          {showHybridFallback && cardRenderMode === 'hybrid_middle' ? (
            <p
              className="mb-1 w-full rounded-md border border-amber-300/80 bg-amber-50/90 px-2 py-1 text-[9px] font-medium text-amber-950"
              role="status"
            >
              Hybrid typography generation failed — fallback overlay active
            </p>
          ) : null}
          <p className={cn(skin.logoText, 'flex items-center gap-1.5')}>
            <span className={skin.logoMark}>
              <Sparkles className="h-2 w-2" strokeWidth={1.75} aria-hidden />
            </span>
            EZA · AI İlişki Aynası
          </p>
          <p className={skin.datePill}>
            <Calendar className="mr-0.5 inline h-2 w-2 opacity-80" aria-hidden />
            {card.dayLabel}
          </p>
        </header>

        <PosterIdentityHeadline identity={identity} skin={skin} isSparse={isSparse} />

        <PosterSceneWindow
          personaFamilyId={card.personaFamilyId}
          renderMode={effectiveRenderMode}
          sceneImageUrl={card.visual?.sceneImageUrl}
          sceneImageStatus={card.visual?.sceneImageStatus}
          skin={skin}
          identity={identity}
          showThemeCaption={false}
          onSceneImageLoad={onSceneImageLoad}
          onSceneImageError={onSceneImageError}
        />

        <PosterReflectionSummary {...reflectionProps} />

        <div className="col-span-12 flex min-h-0 flex-col justify-end gap-1.5">
          <PosterTomorrowHint
            tomorrowHint={card.tomorrowHint}
            skin={skin}
            isSparse={isSparse}
          />
          <footer className={skin.footer}>
            <span>EZA</span>
            <span className="text-center">#EZAİlişkiAynası</span>
            <span className="text-right">eza.ai</span>
          </footer>
        </div>
      </div>

      <MirrorLiveDebugPanel
        card={card}
        entries={entries}
        meta={meta}
        posterVersion={posterVersion}
        renderMode={cardRenderMode}
        layoutDebug={layoutDebug}
        hybridTextFallback={showHybridFallback}
        onForceBmwMercedes={onForceBmwMercedes}
        onToggleHybridMode={onToggleHybridMode}
      />
    </article>
  );
}
