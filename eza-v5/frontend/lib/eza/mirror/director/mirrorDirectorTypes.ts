/**
 * Mirror Director V1 — shared types (frontend mirror of backend schema).
 * schemaVersion: mirror-director-v1
 */

import type { StoryTopicId } from '@/lib/eza/mirror/storyTopicTypes';

export const MIRROR_DIRECTOR_SCHEMA_VERSION = 'mirror-director-v1' as const;

export type MirrorDirectorPrimaryTopic =
  | StoryTopicId
  | 'other';

export type MirrorMeaningAnalysisV1 = {
  schemaVersion: typeof MIRROR_DIRECTOR_SCHEMA_VERSION;
  primaryTopic: MirrorDirectorPrimaryTopic;
  /** Always a controlled enum value (normalized). */
  topicCategory: MirrorDirectorPrimaryTopic;
  secondaryTopics: string[];
  userIntent: string;
  emotionalTone: string[];
  narrative: string;
  visualMotifs: string[];
  forbiddenSymbols: string[];
  suggestedPalette: string[];
  suggestedComposition: string;
  confidence: number;
};

export type MirrorMeaningFailureCode =
  | 'timeout'
  | 'rate_limit'
  | 'invalid_json'
  | 'schema_validation'
  | 'provider_error'
  | 'low_confidence'
  | 'missing_api_key'
  | 'empty_snapshot';

export type MirrorMeaningAnalysisFailure = {
  ok: false;
  code: MirrorMeaningFailureCode;
  message: string;
  retryable?: boolean;
};

export type MirrorMeaningAnalysisSuccess = {
  ok: true;
  analysis: MirrorMeaningAnalysisV1;
  model?: string | null;
  latencyMs?: number | null;
  belowConfidenceThreshold?: boolean;
};

export type MirrorMeaningAnalysisResult =
  | MirrorMeaningAnalysisSuccess
  | MirrorMeaningAnalysisFailure;

export const MIRROR_DIRECTOR_PRIMARY_TOPICS: readonly MirrorDirectorPrimaryTopic[] = [
  'vehicle',
  'travel',
  'architecture',
  'technology_ai',
  'finance',
  'health',
  'food_culture',
  'family',
  'education',
  'spiritual_reflection',
  'general_curiosity',
  'other',
] as const;

const TOPIC_ALIASES: Record<string, MirrorDirectorPrimaryTopic> = {
  tourism: 'travel',
  japan_travel: 'travel',
  trip: 'travel',
  journey: 'travel',
  urbanism: 'architecture',
  urban: 'architecture',
  wellness: 'health',
  fitness: 'health',
  ai: 'technology_ai',
  tech: 'technology_ai',
  technology: 'technology_ai',
  food: 'food_culture',
  culture: 'food_culture',
  spirit: 'spiritual_reflection',
  spiritual: 'spiritual_reflection',
  curiosity: 'general_curiosity',
  general: 'general_curiosity',
};

export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const HIGH_HEURISTIC_CONFIDENCE = 0.62;

export function normalizeMirrorDirectorTopic(
  raw: string | null | undefined
): MirrorDirectorPrimaryTopic {
  if (!raw?.trim()) return 'other';
  const key = raw.trim().toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_');
  if ((MIRROR_DIRECTOR_PRIMARY_TOPICS as readonly string[]).includes(key)) {
    return key as MirrorDirectorPrimaryTopic;
  }
  return TOPIC_ALIASES[key] ?? 'other';
}

export function isStoryTopicId(topic: MirrorDirectorPrimaryTopic): topic is StoryTopicId {
  return topic !== 'other';
}

/** Map Director topic onto existing StoryTopicId (other → general_curiosity). */
export function toStoryTopicId(topic: MirrorDirectorPrimaryTopic): StoryTopicId {
  return topic === 'other' ? 'general_curiosity' : topic;
}
