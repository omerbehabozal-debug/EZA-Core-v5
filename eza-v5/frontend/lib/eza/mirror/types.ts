/**
 * EZA Mirror — Sprint 1 view models (pure data layer).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { RelationshipPeriodDays } from '@/lib/eza/relationshipMapModel';
import type {
  EmotionalRhythmKind,
  ReflectionToneId,
} from '@/lib/eza/mirror/reflectionToneEngine';
import type {
  AiRelationshipModeId,
  StoryToneId,
} from '@/lib/eza/mirror/mirrorStoryEngine';
import type {
  MicroMoodId,
  ReflectionSignals,
  TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

/** Minimum interactions before mirror insights are considered reliable. */
export const MIRROR_MIN_SAMPLES = 3;

export type MirrorDataSource = 'local_history';

export type MirrorIslandTrend = 'growing' | 'stable' | 'fading';

export interface MirrorBehaviorIsland {
  id: string;
  label: string;
  percent: number;
  trend?: MirrorIslandTrend;
  description: string;
  intensity: number;
}

export interface MirrorRisingPattern {
  label: string;
  trend: MirrorIslandTrend;
  description: string;
}

/** Runtime scene image lifecycle (UI layer — user-triggered generation). */
export type MirrorSceneImageStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface MirrorVisualPromptPayload {
  characterId: string;
  characterName: string;
  personaFamilyId: PersonaFamilyId;
  topicLabel: string;
  atmosphereLabel: string;
  emotionLabel: string;
  prompt: string;
  negativePrompt: string;
  stylePreset: string;
  seedHint: string;
  /** Guidance for image APIs and dev QA (Sprint 9A style contract). */
  qualityHints?: string[];
  /** High-level cinematic intent label — no raw chat (Sprint 11J). */
  sceneIntentLabel?: string;
  /** Optional AI scene background (injected by UI when available). */
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
}

export interface DailyMirrorCardModel {
  date: string;
  dayLabel: string;
  headline: string;
  characterName: string;
  personaFamilyId: PersonaFamilyId;
  shortInsight: string;
  userLine: string;
  aiLine: string;
  balanceLine: string;
  signalLevel: string;
  confidence: string;
  energyLabel: string;
  energyScore: number | null;
  shareEnabled: boolean;
  privacyText: string;
  /** Emotional identity layer (Sprint 11B). */
  reflectionTone?: ReflectionToneId;
  reflectionWeight?: number;
  emotionalRhythm?: EmotionalRhythmKind;
  toneHints?: string[];
  quote?: string;
  tomorrowHint?: string;
  themeDescription?: string;
  /** Cinematic daily story layer (Sprint 11C). */
  mirrorStory?: string;
  dailyJourney?: string;
  relationshipMode?: AiRelationshipModeId;
  storyTone?: StoryToneId;
  storyTopicKey?: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  microMood?: MicroMoodId;
  reflectionSignals?: ReflectionSignals;
  /** Textless AI scene prompt bundle (Sprint 6 — no image API yet). */
  visual?: MirrorVisualPromptPayload;
}

export interface RelationshipPatternModel {
  period: RelationshipPeriodDays;
  generalBalanceLabel: string;
  behaviorIslands: MirrorBehaviorIsland[];
  dominantIsland: MirrorBehaviorIsland | null;
  risingPattern: MirrorRisingPattern | null;
  rhythmSummary: string;
  editorialNote: string;
  confidence: string;
  isShareable: false;
}

export interface MirrorStateMeta {
  hasEnoughData: boolean;
  sampleCount: number;
  source: MirrorDataSource;
  generatedAt: string;
  warnings: string[];
}

export interface MirrorStateResult {
  dailyMirrorCard: DailyMirrorCardModel;
  relationshipPattern: RelationshipPatternModel;
  meta: MirrorStateMeta;
}

export interface BuildMirrorStateOptions {
  /** Relationship pattern aggregation window (default 30). */
  periodDays?: RelationshipPeriodDays;
  /** Deterministic seed for copy/persona (default derived from entries). */
  seed?: string;
  /** Override generation timestamp (tests). */
  generatedAt?: string;
}

export type { SavedBehavioralEntry };
