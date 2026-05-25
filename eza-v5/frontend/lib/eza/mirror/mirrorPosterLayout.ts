/**
 * Daily Mirror poster layout — renderMode-driven (Sprint 13C).
 * Scene presence must NOT downgrade hybrid to scene_only overlays.
 */

import type { DailyMirrorCardModel, MirrorSceneImageStatus } from '@/lib/eza/mirror/types';
import { POSTER_HYBRID_ZONE_GRID_ROWS } from '@/lib/eza/mirror/posterEditorialMathematics';
import {
  resolveMirrorRenderMode,
  type MirrorRenderMode,
} from '@/lib/eza/mirror/mirrorRenderMode';

export type MirrorUsedLayout =
  | 'hybrid_middle_placeholder'
  | 'hybrid_middle_with_scene'
  | 'hybrid_middle_fallback_overlay'
  | 'scene_only_placeholder'
  | 'scene_only_with_scene';

export type MirrorLayoutDebug = {
  renderMode: MirrorRenderMode;
  effectiveRenderMode: MirrorRenderMode;
  usedLayout: MirrorUsedLayout;
  frontendMiddleOverlayHidden: boolean;
  sceneImageUrl: string | null;
  sceneImageStatus: MirrorSceneImageStatus | 'idle';
};

/** Card-level renderMode wins; never infer scene_only from missing sceneImageUrl. */
export function resolveCardRenderMode(card: DailyMirrorCardModel | null): MirrorRenderMode {
  return (
    card?.renderMode ??
    card?.visual?.renderMode ??
    resolveMirrorRenderMode()
  );
}

/**
 * Effective mode for layout: hybrid stays hybrid until explicit typography fallback.
 */
export function resolveEffectiveRenderMode(
  card: DailyMirrorCardModel | null,
  explicitHybridFallback = false
): MirrorRenderMode {
  const cardMode = resolveCardRenderMode(card);
  if (cardMode === 'hybrid_middle' && explicitHybridFallback) {
    return 'scene_only';
  }
  return cardMode;
}

export function shouldUseHybridPosterLayout(
  renderMode: MirrorRenderMode,
  explicitHybridFallback: boolean
): boolean {
  return renderMode === 'hybrid_middle' && !explicitHybridFallback;
}

export function resolveUsedLayout(input: {
  renderMode: MirrorRenderMode;
  explicitHybridFallback: boolean;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
}): MirrorUsedLayout {
  const hybrid = shouldUseHybridPosterLayout(input.renderMode, input.explicitHybridFallback);
  const hasScene = Boolean(
    input.sceneImageUrl &&
      input.sceneImageStatus !== 'idle' &&
      input.sceneImageStatus !== 'generating' &&
      input.sceneImageStatus !== 'error'
  );

  if (hybrid) {
    if (input.explicitHybridFallback) return 'hybrid_middle_fallback_overlay';
    return hasScene ? 'hybrid_middle_with_scene' : 'hybrid_middle_placeholder';
  }
  return hasScene ? 'scene_only_with_scene' : 'scene_only_placeholder';
}

export function buildMirrorLayoutDebug(input: {
  card: DailyMirrorCardModel | null;
  explicitHybridFallback?: boolean;
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
}): MirrorLayoutDebug {
  const renderMode = resolveCardRenderMode(input.card);
  const effectiveRenderMode = resolveEffectiveRenderMode(
    input.card,
    input.explicitHybridFallback
  );
  const sceneImageUrl =
    input.sceneImageUrl ?? input.card?.visual?.sceneImageUrl ?? null;
  const sceneImageStatus =
    input.sceneImageStatus ?? input.card?.visual?.sceneImageStatus ?? 'idle';
  const usedLayout = resolveUsedLayout({
    renderMode: effectiveRenderMode,
    explicitHybridFallback: Boolean(input.explicitHybridFallback),
    sceneImageUrl,
    sceneImageStatus,
  });

  return {
    renderMode,
    effectiveRenderMode,
    usedLayout,
    frontendMiddleOverlayHidden: shouldUseHybridPosterLayout(
      effectiveRenderMode,
      Boolean(input.explicitHybridFallback)
    ),
    sceneImageUrl,
    sceneImageStatus,
  };
}

export function buildHybridPosterZoneStyle(): Record<string, string> {
  return {
    ['--poster-zone-rows' as string]: POSTER_HYBRID_ZONE_GRID_ROWS,
    ['--poster-grid-rows' as string]: POSTER_HYBRID_ZONE_GRID_ROWS,
  };
}
