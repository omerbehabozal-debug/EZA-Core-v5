'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
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
  getPosterCardSkin,
  posterTextShadowPremium,
  posterTextShadowStyle,
} from '@/lib/eza/mirror/posterCardSkin';
import {
  buildPremiumPosterCssVars,
  premiumPosterRootStyle,
  resolvePosterPalette,
} from '@/lib/eza/mirror/posterPaletteSystem';
import DailyMirrorPosterScene from '@/components/mirror/DailyMirrorPosterScene';
import ContextualHighlightBand from '@/components/mirror/ContextualHighlightBand';
import MirrorLiveDebugPanel from '@/components/mirror/MirrorLiveDebugPanel';
import { resolveMirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import {
  buildHybridPosterZoneStyle,
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
  /** When hybrid image fails QA, show frontend text overlays (Sprint 13C). */
  hybridTextFallback?: boolean;
};

function InsightGlassCard({
  label,
  line,
  icon,
  skin,
  textShadow,
}: {
  label: string;
  line: string;
  icon: ReactNode;
  skin: ReturnType<typeof getPosterCardSkin>;
  textShadow: {
    insightLabel?: CSSProperties;
    insightLine?: CSSProperties;
  };
}) {
  return (
    <div className={skin.insightCard}>
      <div className={skin.insightIcon}>{icon}</div>
      <p className={skin.insightLabel} style={textShadow.insightLabel}>
        {label}
      </p>
      <p className={skin.insightLine} style={textShadow.insightLine}>
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
  onToggleHybridMode,
  hybridTextFallback = false,
}: DailyMirrorPosterCardProps) {
  const isReady =
    Boolean(meta?.hasEnoughData) && card.shareEnabled && Boolean(card.characterName);
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
  const posterVersion = isHybridMiddle ? 'v8d-hybrid-middle' : 'v8c-scene-contract';
  const content = useMemo(() => buildPosterCardContent(card), [card]);
  const composition = useMemo(() => getPosterComposition(card), [card]);
  const editorial = useMemo(
    () => getEditorialContrast(composition.density),
    [composition.density]
  );
  const palette = useMemo(() => resolvePosterPalette(card), [card]);
  const isPremiumPalette = palette === 'premium_light_editorial';
  const skin = useMemo(
    () => getPosterCardSkin(isHybridMiddle ? 'premium_light_editorial' : palette),
    [isHybridMiddle, palette]
  );
  const textShadow =
    palette === 'premium_light_editorial' ? posterTextShadowPremium : posterTextShadowStyle;
  const cardStyle = useMemo(
    () => ({
      maxWidth: POSTER_CARD_WIDTH_PX,
      ...buildPosterEditorialCssVars(),
      ...(isHybridMiddle ? buildHybridPosterZoneStyle() : buildPosterCompositionStyle(composition)),
      ...(isPremiumPalette ? buildPremiumPosterCssVars() : {}),
      ...(isPremiumPalette ? premiumPosterRootStyle() : {}),
      ...buildEditorialReadabilityVars(editorial),
    }),
    [composition, editorial, isHybridMiddle, isPremiumPalette]
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
      <DailyMirrorPosterScene
        className={cn(skin.sceneBackdrop, skin.sceneBreathing)}
        personaFamilyId={card.personaFamilyId}
        renderMode={effectiveRenderMode}
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

      <div className={cn(skin.globalOverlay, isHybridMiddle && 'opacity-[0.22]')} aria-hidden />
      <div className={cn(skin.globalOverlayBottom, isHybridMiddle && 'opacity-35')} aria-hidden />
      <div className={skin.grain} aria-hidden />
      <div className={skin.accentGlow} aria-hidden />

      <div
        className={skin.contentStack}
        style={{ gridTemplateRows: 'var(--poster-zone-rows)' }}
      >
        <header className={cn(skin.topSafeZone, skin.editorialGrid)}>
          {showHybridFallback && cardRenderMode === 'hybrid_middle' ? (
            <p
              className="col-span-12 mb-1 rounded-md border border-amber-300/80 bg-amber-50/90 px-2 py-1 text-[9px] font-medium text-amber-950"
              role="status"
            >
              Hybrid typography generation failed — fallback overlay active
            </p>
          ) : null}
          <p className={cn(skin.logoText, 'col-span-8 flex items-center gap-1.5')}>
            <span className={skin.logoMark}>
              <Sparkles className="h-2 w-2" strokeWidth={1.75} aria-hidden />
            </span>
            EZA · AI İlişki Aynası
          </p>
          <p className={cn(skin.datePill, 'col-span-4 text-right')}>
            <Calendar className="mr-0.5 inline h-2 w-2 opacity-80" aria-hidden />
            {card.dayLabel}
          </p>
        </header>

        {!isHybridMiddle ? (
          <div className={cn(skin.titleSafeZone, skin.editorialGrid)}>
            <h2
              id="daily-mirror-poster-title"
              className={skin.heroTitle}
              style={textShadow.heroTitle}
            >
              {isSparse ? 'Yansıma hazırlanıyor' : content.journeyHeadline}
            </h2>
            <div className={cn(skin.storyWrap, 'col-span-12')}>
              <p className={skin.story} style={textShadow.story}>
                {isSparse ? MIRROR_INSUFFICIENT : content.storyLine}
              </p>
            </div>
          </div>
        ) : (
          <h2 id="daily-mirror-poster-title" className="sr-only">
            {content.journeyHeadline}
          </h2>
        )}

        <div
          className={cn(skin.sceneSpacer, skin.editorialGrid)}
          aria-hidden={isSparse || isHybridMiddle}
        >
          {!isSparse && !isHybridMiddle ? (
            <div className={cn(skin.highlightAnchor, 'col-span-12')}>
              <ContextualHighlightBand
                highlight={content.contextualHighlight}
                emphasis={highlightEmphasis}
                skin={skin}
              />
            </div>
          ) : null}
        </div>

        {!isHybridMiddle ? (
          <div className={cn(skin.quoteZone, skin.editorialGrid)}>
            {!isSparse ? (
              <p
                className={cn(skin.quoteText, 'col-span-12')}
                style={textShadow.quoteText}
              >
                <span className={skin.quoteMark} aria-hidden>
                  “
                </span>
                {content.quote}
                <span className={skin.quoteMark} aria-hidden>
                  ”
                </span>
              </p>
            ) : null}
          </div>
        ) : null}

        {!isSparse ? (
          <div className={cn(skin.insightsRow, skin.editorialGrid)}>
            <InsightGlassCard
              skin={skin}
              textShadow={textShadow}
              label="Sen"
              line={sen?.value ?? '—'}
              icon={<User className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
            <InsightGlassCard
              skin={skin}
              textShadow={textShadow}
              label="AI"
              line={ai?.value ?? '—'}
              icon={<Sparkles className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
            <InsightGlassCard
              skin={skin}
              textShadow={textShadow}
              label="Denge"
              line={balance?.value ?? '—'}
              icon={<Heart className="h-2.5 w-2.5" strokeWidth={2} aria-hidden />}
            />
          </div>
        ) : null}

        <footer className={cn(skin.footer, skin.editorialGrid)}>
          <span className="col-span-4">EZA</span>
          <span className="col-span-4 text-center">#EZAİlişkiAynası</span>
          <span className="col-span-4 text-right">eza.ai</span>
        </footer>
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
