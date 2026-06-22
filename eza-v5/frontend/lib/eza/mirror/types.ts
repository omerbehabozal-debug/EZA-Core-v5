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
import type { MirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import type { HybridPosterTextPayload } from '@/lib/eza/mirror/hybridPosterPromptBuilder';
import type { CharacterArchetypeId } from '@/lib/eza/mirror/ezaCharacterBible';
import type { DailyAvatarType } from '@/lib/eza/mirror/dailyAvatarRegistry';

/** Minimum interactions before mirror insights are considered reliable. */
export const MIRROR_MIN_SAMPLES = 3;

export type MirrorPipelineVersion = 'v1' | 'v2' | 'v3';

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
  /** Sprint 12B — intent lock fingerprint for scene cache busting. */
  lockedPrimaryIntent?: import('@/lib/eza/mirror/sceneIntentTypes').ConversationVisualIntentId | null;
  primaryIntentId?: import('@/lib/eza/mirror/sceneIntentTypes').ConversationVisualIntentId;
  compositionTemplate?: import('@/lib/eza/mirror/sceneIntentTypes').SceneCompositionTemplateId;
  intentFingerprint?: string;
  /** Sprint 12C hard scene contract id when vehicle locked. */
  sceneContractId?: string;
  /** Optional AI scene background (injected by UI when available). */
  sceneImageUrl?: string | null;
  sceneImageStatus?: MirrorSceneImageStatus;
  /** Sprint 13C — scene_only (textless) vs hybrid_middle (embedded copy). */
  renderMode?: MirrorRenderMode;
  /** Exact Turkish copy sent to OpenAI in hybrid mode. */
  hybridTextPayload?: HybridPosterTextPayload;
  /** Dev QA — hybrid image text quality unknown; frontend overlay fallback active. */
  hybridTextRisk?: boolean;
  hybridFallbackReason?: string;
  /** hybrid_middle | scene_only_director */
  usedPromptType?: import('@/lib/eza/mirror/hybridPosterDebug').UsedPromptType;
  /** Last generate-scene provider from API response */
  imageProvider?: string;
  /** Backend OpenAI prompt truncation risk (>4000 chars) */
  promptTruncated?: boolean;
  /** Dev OCR/heuristic probe result */
  hybridOcrProbe?: string;
  /** Sprint 2 — exact headline/quote embedded in master poster scene. */
  masterPosterText?: { headline: string; quote: string };
  sceneSubtopicId?: import('@/lib/eza/mirror/sceneSubtopicTypes').SceneSubtopicId;
  sceneKeywords?: string[];
  /** V5 minimal render contract — backend passthrough, no legacy append. */
  promptContract?: string;
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
  /** Sprint 13C — authoritative poster layout mode (mirrors visual.renderMode). */
  renderMode?: MirrorRenderMode;
  /** P0 Dynamic Persona — behavior family (user-facing). */
  behaviorFamilyLabel?: string;
  dailyAvatarId?: string;
  dailyAvatarName?: string;
  dailyAvatarEmoji?: string;
  dailyAvatarType?: DailyAvatarType;
  dailyAvatarArchetypeId?: CharacterArchetypeId;
  dailyThemeTitle?: string;
  dailyThemeSubtitle?: string;
  dailySceneConcept?: string;
  /** P4-A — narrative-first scene pipeline (optional for legacy snapshots). */
  narrativeCoreId?: import('@/lib/eza/mirror/narrativeTypes').NarrativeCoreId;
  storyTensionTitle?: string;
  storyTensionSummary?: string;
  mirrorMoment?: string;
  sceneArchetypeId?: import('@/lib/eza/mirror/narrativeTypes').SceneArchetypeId;
  sceneArchetypeLabel?: string;
  /** V2 cinematic poster pipeline metadata. */
  mirrorPipelineVersion?: MirrorPipelineVersion;
  mirrorSeason?: string;
  closingLine?: string;
  mirrorV2Payload?: import('@/lib/eza/mirror/conversationMirrorV2/types').SainaMirrorPayload;
  mirrorV3Payload?: import('@/lib/eza/mirror/conversationMirrorV3/types').SainaMirrorV3Payload;
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
  pipelineVersion?: MirrorPipelineVersion;
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
  /** Active chat thread id — Conversation Mirror scope. */
  conversationId?: string;
}

export type { SavedBehavioralEntry };
