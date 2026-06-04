/**
 * P4-C4 — presentation-only adaptive poster tone (heuristic; no pixel analysis).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { NarrativeCoreId } from '@/lib/eza/mirror/narrativeTypes';
import type { SceneArchetypeId } from '@/lib/eza/mirror/narrativeTypes';
import { shouldUseHybridPosterLayout } from '@/lib/eza/mirror/mirrorPosterLayout';
import { resolveCardRenderMode } from '@/lib/eza/mirror/mirrorPosterLayout';

export type PosterSceneToneId =
  | 'warm_gold'
  | 'cool_silver'
  | 'rose_warm'
  | 'dark_gold'
  | 'neutral_silver';

export type PosterSceneTone = {
  id: PosterSceneToneId;
  tone: 'warm' | 'cool' | 'neutral';
  contrast: 'dark-scene' | 'light-scene' | 'mixed';
  accent: 'gold' | 'silver' | 'blue' | 'rose' | 'green';
};

const WARM_GOLD: PosterSceneTone = {
  id: 'warm_gold',
  tone: 'warm',
  contrast: 'dark-scene',
  accent: 'gold',
};

const COOL_SILVER: PosterSceneTone = {
  id: 'cool_silver',
  tone: 'cool',
  contrast: 'dark-scene',
  accent: 'silver',
};

const ROSE_WARM: PosterSceneTone = {
  id: 'rose_warm',
  tone: 'warm',
  contrast: 'mixed',
  accent: 'rose',
};

const DARK_GOLD: PosterSceneTone = {
  id: 'dark_gold',
  tone: 'warm',
  contrast: 'dark-scene',
  accent: 'gold',
};

const NEUTRAL_SILVER: PosterSceneTone = {
  id: 'neutral_silver',
  tone: 'neutral',
  contrast: 'dark-scene',
  accent: 'silver',
};

function themeHintsTravel(theme: string): boolean {
  return /keşif|seyahat|travel|italy|italya|yolculuk|explore/i.test(theme);
}

function matchesCore(
  core: NarrativeCoreId | undefined,
  ids: NarrativeCoreId[]
): boolean {
  return Boolean(core && ids.includes(core));
}

function matchesArchetype(
  archetype: SceneArchetypeId | undefined,
  ids: SceneArchetypeId[]
): boolean {
  return Boolean(archetype && ids.includes(archetype));
}

/**
 * Maps narrative / theme / intent signals to editorial overlay tone.
 */
export function resolvePosterSceneTone(card: DailyMirrorCardModel): PosterSceneTone {
  const core = card.narrativeCoreId;
  const archetype = card.sceneArchetypeId;
  const theme = `${card.dailyThemeTitle ?? ''} ${card.dailyThemeSubtitle ?? ''}`.trim();
  const topic = card.storyTopicKey;
  const intent = card.visual?.lockedPrimaryIntent;
  const sceneLabel = (card.visual?.sceneIntentLabel ?? '').toLowerCase();

  if (
    intent === 'premium_vehicle_comparison' ||
    sceneLabel.includes('car comparison') ||
    sceneLabel.includes('premium vehicle') ||
    matchesArchetype(archetype, ['comparison_studio'])
  ) {
    return DARK_GOLD;
  }

  if (matchesArchetype(archetype, ['ledger']) || matchesCore(core, ['balance'])) {
    return { ...DARK_GOLD, accent: 'gold' };
  }

  if (matchesCore(core, ['care']) || matchesArchetype(archetype, ['sanctuary'])) {
    return ROSE_WARM;
  }

  if (
    matchesCore(core, ['clarity']) ||
    matchesArchetype(archetype, ['quiet_mirror'])
  ) {
    return COOL_SILVER;
  }

  if (
    matchesCore(core, ['exploration', 'uncertainty', 'planning']) ||
    matchesArchetype(archetype, ['threshold', 'crossroads']) ||
    topic === 'travel' ||
    topic === 'architecture' ||
    themeHintsTravel(theme)
  ) {
    return WARM_GOLD;
  }

  if (matchesCore(core, ['creation']) || matchesArchetype(archetype, ['workshop', 'studio_flow'])) {
    return { ...WARM_GOLD, accent: 'gold' };
  }

  if (matchesArchetype(archetype, ['comparison_studio'])) {
    return DARK_GOLD;
  }

  const renderMode = resolveCardRenderMode(card);
  if (shouldUseHybridPosterLayout(renderMode, false)) {
    return { ...NEUTRAL_SILVER, contrast: 'light-scene' };
  }

  return NEUTRAL_SILVER;
}
