/**
 * Scene subtopic resolver — maps whitelist cue tokens to visual sub-worlds.
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';
import type { SceneSubtopicId, SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';
import {
  MAX_SCENE_KEYWORDS,
  MAX_SOURCE_CUE_TOKENS,
} from '@/lib/eza/mirror/sceneSubtopicTypes';
import {
  ARCH_FACADE_TOKENS,
  ARCH_MATERIAL_TOKENS,
  ARCH_MOSQUE_TOKENS,
  countMatching,
  hasAnyToken,
  TECH_CODING_TOKENS,
  TECH_PRODUCT_TOKENS,
  TECH_STRATEGY_TOKENS,
  TRAVEL_CITY_TOKENS,
  TRAVEL_JOURNEY_TOKENS,
  VEHICLE_EV_TOKENS,
  VEHICLE_LUXURY_TOKENS,
  VEHICLE_SUV_TOKENS,
} from '@/lib/eza/mirror/sceneSubtopicCueRegistry';
import { getSceneKeywordProfile, resolveSceneKeywords } from '@/lib/eza/mirror/sceneKeywordRegistry';

const CONFIDENCE_GENERIC = 0.2;
const CONFIDENCE_MATCH = 0.72;
const CONFIDENCE_STRONG = 0.88;

function normalizeTokens(tokens: string[]): string[] {
  const out: string[] = [];
  for (const raw of tokens) {
    const t = String(raw).trim().toLowerCase().slice(0, 24);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_SOURCE_CUE_TOKENS) break;
  }
  return out;
}

function hasToken(tokens: readonly string[], token: string): boolean {
  return tokens.includes(token.toLowerCase());
}

function resolveTravelSubtopic(tokens: string[]): {
  subtopic: SceneSubtopicId;
  confidence: number;
} | null {
  const hasSemerkant = hasToken(tokens, 'semerkant');
  const hasBuhara = hasToken(tokens, 'buhara');
  const hasUzbekistan = hasToken(tokens, 'özbekistan');

  if (
    (hasSemerkant && hasBuhara) ||
    (hasUzbekistan && hasSemerkant && hasBuhara) ||
    (hasSemerkant && hasUzbekistan)
  ) {
    return { subtopic: 'travel_silk_road', confidence: CONFIDENCE_STRONG };
  }
  if (hasSemerkant) {
    return { subtopic: 'travel_samarkand', confidence: CONFIDENCE_MATCH };
  }
  if (hasBuhara) {
    return { subtopic: 'travel_bukhara', confidence: CONFIDENCE_MATCH };
  }
  if (hasUzbekistan) {
    return { subtopic: 'travel_uzbekistan', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, TRAVEL_JOURNEY_TOKENS)) {
    return { subtopic: 'travel_generic_journey', confidence: CONFIDENCE_MATCH };
  }
  return null;
}

function resolveArchitectureSubtopic(tokens: string[]): {
  subtopic: SceneSubtopicId;
  confidence: number;
} | null {
  if (hasAnyToken(tokens, ARCH_MOSQUE_TOKENS)) {
    return { subtopic: 'arch_mosque_heritage', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, ARCH_FACADE_TOKENS)) {
    return { subtopic: 'arch_facade_restoration', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, ARCH_MATERIAL_TOKENS)) {
    return { subtopic: 'arch_material_study', confidence: CONFIDENCE_MATCH };
  }
  return null;
}

function resolveVehicleSubtopic(tokens: string[]): {
  subtopic: SceneSubtopicId;
  confidence: number;
} | null {
  if (hasAnyToken(tokens, VEHICLE_EV_TOKENS)) {
    return { subtopic: 'vehicle_ev_comparison', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, VEHICLE_SUV_TOKENS)) {
    return { subtopic: 'vehicle_suv_comparison', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, VEHICLE_LUXURY_TOKENS)) {
    return { subtopic: 'vehicle_luxury_sedan_comparison', confidence: CONFIDENCE_STRONG };
  }
  return null;
}

function resolveTechSubtopic(tokens: string[]): {
  subtopic: SceneSubtopicId;
  confidence: number;
} | null {
  const productHits = countMatching(tokens, TECH_PRODUCT_TOKENS);
  if (productHits >= 2 || (productHits >= 1 && hasAnyToken(tokens, TECH_CODING_TOKENS))) {
    return { subtopic: 'tech_product_building', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, TECH_CODING_TOKENS)) {
    return { subtopic: 'tech_coding_ai', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, TECH_PRODUCT_TOKENS)) {
    return { subtopic: 'tech_product_building', confidence: CONFIDENCE_MATCH };
  }
  if (hasAnyToken(tokens, TECH_STRATEGY_TOKENS)) {
    return { subtopic: 'tech_startup_strategy', confidence: CONFIDENCE_MATCH };
  }
  return null;
}

function resolveByTopic(
  primaryTopic: StoryTopicId,
  tokens: string[]
): { subtopic: SceneSubtopicId; confidence: number } | null {
  switch (primaryTopic) {
    case 'travel':
      return resolveTravelSubtopic(tokens);
    case 'architecture':
      return resolveArchitectureSubtopic(tokens);
    case 'vehicle':
      return resolveVehicleSubtopic(tokens);
    case 'technology_ai':
      return resolveTechSubtopic(tokens);
    default:
      return null;
  }
}

function buildResolution(
  subtopic: SceneSubtopicId,
  confidence: number,
  sourceCueTokens: string[]
): SceneSubtopicResolution {
  const profile = getSceneKeywordProfile(subtopic);
  return {
    primarySubtopic: subtopic,
    sceneKeywords: resolveSceneKeywords(subtopic).slice(0, MAX_SCENE_KEYWORDS),
    environmentOverride: profile.environmentOverride,
    heroObjectOverrides: profile.heroObjectOverrides
      ? [...profile.heroObjectOverrides]
      : undefined,
    confidence,
    sourceCueTokens,
  };
}

export function resolveSceneSubtopics(
  primaryTopic: StoryTopicId,
  cueTokens: string[]
): SceneSubtopicResolution {
  const sourceCueTokens = normalizeTokens(cueTokens);

  if (!sourceCueTokens.length) {
    return buildResolution('topic_generic', CONFIDENCE_GENERIC, []);
  }

  const matched = resolveByTopic(primaryTopic, sourceCueTokens);
  if (!matched || matched.confidence < 0.35) {
    return buildResolution('topic_generic', CONFIDENCE_GENERIC, sourceCueTokens);
  }

  return buildResolution(matched.subtopic, matched.confidence, sourceCueTokens);
}
