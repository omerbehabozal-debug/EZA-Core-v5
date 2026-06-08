/**
 * Cinematic Art Director — subtopic-aware premium editorial scene language.
 */

import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';
import {
  getArtDirectionProfile,
  getTopicArtDirectionFallback,
  type ArtDirectionProfile,
} from '@/lib/eza/mirror/artDirectionRegistry';
import type { SceneSubtopicId, SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';
import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { VisualNarrativeDirection } from '@/lib/eza/mirror/visualNarrativeDirector';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

export const ART_DIRECTION_BLOCK_MAX = 400;

export const GENERIC_STYLE_FALLBACK =
  'premium editorial film still, warm emotional realism, not cartoon not mascot not AI wallpaper';

const SUBTOPIC_CONFIDENCE_MIN = 0.35;

const VEHICLE_SUBTOPICS: SceneSubtopicId[] = [
  'vehicle_luxury_sedan_comparison',
  'vehicle_suv_comparison',
  'vehicle_ev_comparison',
];

function storyTopicFromSceneKey(topicKey: SceneTopicKey): StoryTopicId | null {
  const map: Partial<Record<SceneTopicKey, StoryTopicId>> = {
    travel: 'travel',
    architecture: 'architecture',
    creativity: 'technology_ai',
    finance: 'finance',
    health: 'health',
    friendship: 'family',
    general: 'general_curiosity',
  };
  return map[topicKey] ?? null;
}

export function resolveArtDirection(input: {
  sceneSubtopicResolution?: SceneSubtopicResolution;
  topicKey: SceneTopicKey;
  lockedIntent?: LockedPrimaryIntentId | null;
}): ArtDirectionProfile {
  const subtopicRes = input.sceneSubtopicResolution;
  const subtopic = subtopicRes?.primarySubtopic ?? 'topic_generic';
  const confidence = subtopicRes?.confidence ?? 0;

  if (input.lockedIntent === 'premium_vehicle_comparison') {
    if (subtopic === 'vehicle_suv_comparison' || subtopic === 'vehicle_ev_comparison') {
      return getArtDirectionProfile(subtopic);
    }
    return getArtDirectionProfile('vehicle_luxury_sedan_comparison');
  }

  if (confidence >= SUBTOPIC_CONFIDENCE_MIN && subtopic !== 'topic_generic') {
    return getArtDirectionProfile(subtopic);
  }

  const storyTopic = storyTopicFromSceneKey(input.topicKey);
  if (storyTopic && storyTopic !== 'general_curiosity') {
    return getTopicArtDirectionFallback(storyTopic);
  }

  return getArtDirectionProfile('topic_generic');
}

export function buildArtDirectionPromptBlock(profile: ArtDirectionProfile): string {
  const parts = [
    `lighting: ${profile.lighting}`,
    `lens: ${profile.lens}`,
    `composition: ${profile.composition}`,
    `mood: ${profile.mood}`,
    `quality: ${profile.qualityFilters.join(', ')}`,
  ];
  let block = parts.join('; ');
  if (block.length > ART_DIRECTION_BLOCK_MAX) {
    block = block.slice(0, ART_DIRECTION_BLOCK_MAX);
    const lastSemi = block.lastIndexOf(';');
    if (lastSemi > ART_DIRECTION_BLOCK_MAX * 0.6) {
      block = block.slice(0, lastSemi);
    }
  }
  return block;
}

export function mergeArtDirectionNegatives(
  baseNegative: string,
  profile: ArtDirectionProfile
): string {
  const parts = baseNegative
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set(parts.map((p) => p.toLowerCase()));

  for (const extra of profile.negativeExtras) {
    const key = extra.toLowerCase();
    if (!seen.has(key)) {
      parts.push(extra);
      seen.add(key);
    }
  }

  if (profile.forbiddenEnvironments?.length) {
    for (const env of profile.forbiddenEnvironments) {
      const key = env.toLowerCase();
      if (!seen.has(key)) {
        parts.push(env);
        seen.add(key);
      }
    }
  }

  return parts.join(', ');
}

export function applyArtDirectionToNarrative(
  direction: VisualNarrativeDirection,
  profile: ArtDirectionProfile,
  subtopic?: SceneSubtopicId
): VisualNarrativeDirection {
  const next: VisualNarrativeDirection = { ...direction };

  if (profile.forbiddenEnvironments?.length) {
    const merged = new Set(next.forbiddenSceneTypes.map((f) => f.toLowerCase()));
    for (const env of profile.forbiddenEnvironments) {
      if (!merged.has(env.toLowerCase())) {
        next.forbiddenSceneTypes = [...next.forbiddenSceneTypes, env];
      }
    }
  }

  if (subtopic && VEHICLE_SUBTOPICS.includes(subtopic)) {
    next.cameraEnergy = 'cinematic_tension';
  }

  return next;
}
