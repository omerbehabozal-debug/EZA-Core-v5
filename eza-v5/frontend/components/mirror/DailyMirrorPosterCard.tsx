'use client';

import { useMemo } from 'react';
import { Calendar, Crown, Sparkles, User, Bot } from 'lucide-react';
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
import {
  buildPosterEditorialCssVars,
  POSTER_READABILITY_INLINE,
} from '@/lib/eza/mirror/posterEditorialMathematics';
import {
  buildEditorialReadabilityVars,
  getEditorialContrast,
} from '@/lib/eza/mirror/posterReadabilitySystem';
import { getPosterCardSkin } from '@/lib/eza/mirror/posterCardSkin';
import { resolvePosterSceneTone } from '@/lib/eza/mirror/posterSceneTone';
import {
  buildPremiumPosterCssVars,
  premiumPosterRootStyle,
  resolvePosterPalette,
} from '@/lib/eza/mirror/posterPaletteSystem';
import PosterIdentityHeadline from '@/components/mirror/PosterIdentityHeadline';
import FullCanvasScene from '@/components/mirror/FullCanvasScene';
import PosterTomorrowHint from '@/components/mirror/PosterTomorrowHint';
import MirrorLiveDebugPanel from '@/components/mirror/MirrorLiveDebugPanel';
import {
  buildMirrorLayoutDebug,
  resolveCardRenderMode,
  resolveEffectiveRenderMode,
  shouldUseHybridPosterLayout,
} from '@/lib/eza/mirror/mirrorPosterLayout';
import { isV2MirrorCard } from '@/lib/eza/mirror/conversationMirrorV2/applyV2SceneOverlay';
import { isV3MirrorCard } from '@/lib/eza/mirror/conversationMirrorV3/applyV3SceneOverlay';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

function rhythmInsightDescription(statusWord: string): string {
  const map: Record<string, string> = {
    Güçleniyor: 'Bugünkü akışın daha da dengeleniyor.',
    Dengeleniyor: 'Bugünkü akışın daha da dengeleniyor.',
    Derinleşiyor: 'Bugünkü sohbetin daha derin bir iz bırakıyor.',
    Akışta: 'Bugünkü tempo akıcı ve ölçülü.',
    Sakinleşiyor: 'Bugünkü tempo sakin ve dengeli.',
  };
  return map[statusWord] ?? 'Bugünkü akışın daha da dengeleniyor.';
}

function resolveMirrorScores(card: DailyMirrorCardModel): { sen: number; ai: number } {
  const sen =
    card.energyScore !== null && Number.isFinite(card.energyScore)
      ? Math.round(Math.min(100, Math.max(0, card.energyScore)))
      : 78;
  const weightBoost = Math.round((card.reflectionWeight ?? 0.5) * 12);
  const ai = Math.min(100, Math.max(sen, sen + 4 + weightBoost));
  return { sen, ai };
}

export type DailyMirrorPosterCardProps = {
  card: DailyMirrorCardModel;
  meta?: MirrorStateMeta;
  entries?: SavedBehavioralEntry[];
  onSceneImageLoad?: () => void;
  onSceneImageError?: () => void;
  onForceBmwMercedes?: () => void;
  onToggleHybridMode?: () => void;
  hybridTextFallback?: boolean;
  /** Sidebar preview — scene-only when hybrid/V2 poster art is baked into the image. */
  embedded?: boolean;
};

/**
 * P4-B — full-bleed editorial scene + glass UI overlay stack.
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
  embedded = false,
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
  const posterVersion = isHybridMiddle ? 'v10-full-canvas-hybrid' : 'v10-full-canvas';
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
  const sceneTone = useMemo(() => resolvePosterSceneTone(card), [card]);
  const skin = useMemo(
    () => getPosterCardSkin(palette, 'identity_first', sceneTone.id),
    [palette, sceneTone.id]
  );
  const scores = useMemo(() => resolveMirrorScores(card), [card]);
  const rhythmDescription = useMemo(
    () => rhythmInsightDescription(content.rhythm.word),
    [content.rhythm.word]
  );
  const v3ImageOnlyPoster = isV3MirrorCard(card);
  const sceneCarriesPosterArt =
    layoutDebug.usedLayout === 'hybrid_middle_with_scene' ||
    isV2MirrorCard(card) ||
    v3ImageOnlyPoster;
  const embeddedScenePreview =
    v3ImageOnlyPoster || (embedded && sceneCarriesPosterArt);
  const hideFrontendMiddle = layoutDebug.frontendMiddleOverlayHidden || v3ImageOnlyPoster;
  const hideRhythmAndFooter = sceneCarriesPosterArt || v3ImageOnlyPoster;
  const hideMasthead =
    (isV2MirrorCard(card) && sceneCarriesPosterArt) || v3ImageOnlyPoster;

  const cardStyle = useMemo(
    () => ({
      width: '100%',
      maxWidth: 'var(--poster-display-max-width, 100%)',
      ...buildPosterEditorialCssVars(),
      ...buildPosterCompositionStyle(composition),
      ...(palette === 'premium_light_editorial'
        ? { ...buildPremiumPosterCssVars(), ...premiumPosterRootStyle() }
        : {}),
      ...buildEditorialReadabilityVars(editorial),
    }),
    [composition, editorial, palette]
  );

  const posterUsesFourFive =
    v3ImageOnlyPoster || (embeddedScenePreview && sceneCarriesPosterArt);

  return (
    <article
      data-mirror-card-root
      data-mirror-aspect={posterUsesFourFive ? '4-5' : '9-16'}
      data-mirror-poster={posterVersion}
      data-mirror-render-mode={cardRenderMode}
      data-mirror-effective-render-mode={effectiveRenderMode}
      data-mirror-used-layout={layoutDebug.usedLayout}
      data-mirror-palette={palette}
      data-mirror-scene-tone={sceneTone.id}
      data-mirror-density={composition.density}
      data-mirror-embedded-preview={embeddedScenePreview ? 'scene-only' : undefined}
      className={cn(skin.root, posterUsesFourFive && 'aspect-[4/5]')}
      style={cardStyle}
      aria-labelledby={embeddedScenePreview ? undefined : 'daily-mirror-poster-title'}
    >
      <FullCanvasScene
        personaFamilyId={card.personaFamilyId}
        renderMode={effectiveRenderMode}
        sceneImageUrl={card.visual?.sceneImageUrl}
        sceneImageStatus={card.visual?.sceneImageStatus}
        skin={skin}
        imageFit={embeddedScenePreview ? 'contain' : 'cover'}
        onSceneImageLoad={onSceneImageLoad}
        onSceneImageError={onSceneImageError}
      />

      {!embeddedScenePreview ? (
        <>
          <div className={skin.overlayScrim} aria-hidden>
            <div className={skin.overlayTopScrim} aria-hidden />
            <div className={skin.overlayBottomScrim} aria-hidden />
          </div>

          <div className={skin.grain} aria-hidden />
        </>
      ) : null}

      {!embeddedScenePreview ? (
        <div className={skin.overlayStack}>
          {!hideMasthead ? (
            <header className={skin.overlayHeader}>
              {showHybridFallback && cardRenderMode === 'hybrid_middle' ? (
                <p
                  className="mb-1 w-full rounded-md border border-amber-300/50 bg-amber-950/40 px-2 py-1 text-[9px] font-medium text-amber-50 backdrop-blur-md"
                  role="status"
                >
                  Hybrid typography generation failed — fallback overlay active
                </p>
              ) : null}
              <p
                className={cn(skin.logoText, 'flex items-center gap-2')}
                style={POSTER_READABILITY_INLINE.masthead}
              >
                <span className={skin.logoMark}>
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                </span>
                EZA · AI İlişki Aynası
              </p>
              <span className={skin.datePillGlass}>
                <span className={skin.datePill} style={POSTER_READABILITY_INLINE.masthead}>
                  <Calendar className="mr-1 inline h-3 w-3 opacity-90" strokeWidth={1.5} aria-hidden />
                  {card.dayLabel}
                </span>
              </span>
            </header>
          ) : null}

          {!hideFrontendMiddle ? (
            <PosterIdentityHeadline identity={identity} skin={skin} isSparse={isSparse} />
          ) : null}

          <div className="min-h-0 flex-1" aria-hidden />

          {!isSparse && !hideRhythmAndFooter ? (
            <section
              className={skin.rhythmWhisperZone ?? skin.overlayReflection}
              aria-label="İlişki ritmi"
            >
              <p
                className={cn(skin.rhythmWhisperEyebrow, 'flex items-center gap-2')}
                style={POSTER_READABILITY_INLINE.panelLabel}
              >
                <Crown className="h-3.5 w-3.5 text-[#E8D5B5]" strokeWidth={1.5} aria-hidden />
                {content.rhythm.eyebrow}
              </p>
              <p className={skin.rhythmWhisperWord} style={POSTER_READABILITY_INLINE.headline}>
                {content.rhythm.word}
              </p>
              <p className={skin.insightPanelDesc} style={POSTER_READABILITY_INLINE.panelBody}>
                {rhythmDescription}
              </p>
              <div className={skin.insightPanelScores}>
                <span className={skin.insightPanelScoreItem} style={POSTER_READABILITY_INLINE.panelBody}>
                  <User className="h-3.5 w-3.5 text-[#F0EEEA]" strokeWidth={1.5} aria-hidden />
                  Sen
                  <span className={skin.insightPanelScoreValue} style={POSTER_READABILITY_INLINE.headline}>
                    {scores.sen}
                  </span>
                </span>
                <span className={skin.insightPanelScoreDivider} aria-hidden>
                  ·
                </span>
                <span className={skin.insightPanelScoreItem} style={POSTER_READABILITY_INLINE.panelBody}>
                  <Bot className="h-3.5 w-3.5 text-[#F0EEEA]" strokeWidth={1.5} aria-hidden />
                  AI
                  <span className={skin.insightPanelScoreValue} style={POSTER_READABILITY_INLINE.headline}>
                    {scores.ai}
                  </span>
                </span>
              </div>
            </section>
          ) : null}

          {!hideRhythmAndFooter ? (
            <div className={cn(skin.overlayFooter, 'flex min-h-0 flex-col justify-end')}>
              <div className={skin.overlayFooterScrim} aria-hidden />
              <PosterTomorrowHint
                tomorrowHint={card.tomorrowHint}
                skin={skin}
                isSparse={isSparse}
                readabilityStyle={POSTER_READABILITY_INLINE.footer}
              />
            </div>
          ) : null}
        </div>
      ) : null}

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
