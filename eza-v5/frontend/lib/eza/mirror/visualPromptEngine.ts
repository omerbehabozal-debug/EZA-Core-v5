/**
 * EZA Mirror — Visual Prompt Engine (textless scene prompts, no image API).
 */

import type { PersonaFamilyId } from '@/lib/eza/standalonePersonas';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';
import type { UserObservationCategoryId } from '@/lib/eza/dailyObservation';
import { classifyDayFromEntries } from '@/lib/eza/dailyObservation';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';
import {
  deriveConversationVisualIntent,
  buildConversationScenePromptBlock,
  resolveSceneCharacterPhrase,
  type ConversationVisualIntent,
} from '@/lib/eza/mirror/conversationVisualIntent';
import {
  deriveReflectionSignals,
  type ReflectionSignals,
  type TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import {
  SCENE_TOPIC_LABEL,
  SCENE_TOPIC_PRESETS,
  type SceneTopicKey,
} from '@/lib/eza/mirror/visualPromptPresets';
import {
  ARCHITECTURE_QUALITY_HINTS,
  buildArchitectureStorytellingPhrase,
  buildMirrorNegativePrompt,
  buildVisualCanonLayers,
  EZA_ARCHITECTURE_CAMERA,
  EZA_ARCHITECTURE_OVERLAY_RULES,
  EZA_ARCHITECTURE_STYLE_CONTRACT,
  EZA_GLOBAL_STYLE_LOCK,
  EZA_OVERLAY_LAYOUT_RULES,
} from '@/lib/eza/mirror/ezaVisualCanon';
import {
  DEFAULT_ATMOSPHERE_LABEL,
  DEFAULT_EMOTION_LABEL,
} from '@/lib/eza/mirror/visualPromptPresets';
import { STYLE_PRESET, VISUAL_QUALITY_HINTS } from '@/lib/eza/mirror/visualStyleContract';

export interface MirrorVisualPrompt {
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
  qualityHints: string[];
  /** High-level scene intent for dev QA — no raw message content */
  sceneIntentLabel?: string;
}

export interface BuildVisualPromptInput {
  characterId: PersonaFamilyId;
  characterName: string;
  personaFamilyId: PersonaFamilyId;
  topicKey: SceneTopicKey;
  atmosphereLabel?: string;
  emotionLabel?: string;
  seedHint: string;
  conversationIntent?: ConversationVisualIntent;
}

const CATEGORY_TO_TOPIC: Partial<Record<UserObservationCategoryId, SceneTopicKey>> = {
  decision_support: 'finance',
  exploration: 'travel',
  creative_ideas: 'creativity',
  intellectual_depth: 'general',
  explanation_seek: 'architecture',
  question_clarity: 'architecture',
  clarity_seek: 'architecture',
  flow_harmony: 'health',
  safe_balance: 'health',
  sensitive_signals: 'friendship',
  balanced: 'general',
  quiet: 'health',
};

const PERSONA_TO_TOPIC_BIAS: Partial<Record<PersonaFamilyId, SceneTopicKey>> = {
  decision_direction: 'finance',
  planning_structure: 'finance',
  fast_practical: 'finance',
  curiosity_exploration: 'travel',
  ideation_creation: 'creativity',
  deep_thinking: 'general',
  clarity_simplification: 'architecture',
  sensitive_careful: 'friendship',
  balanced_calm: 'general',
  trust_verification: 'travel',
};

const BACKEND_USER_PATTERN_TO_TOPIC: Record<string, SceneTopicKey> = {
  decision_direction: 'finance',
  planning_structure: 'finance',
  fast_practical: 'finance',
  curiosity_exploration: 'travel',
  ideation_creation: 'creativity',
  deep_thinking: 'general',
  clarity_simplification: 'architecture',
  sensitive_careful: 'friendship',
  balanced_calm: 'health',
  trust_verification: 'travel',
};

const INTENT_TO_TOPIC: Record<string, SceneTopicKey> = {
  finance: 'finance',
  financial: 'finance',
  money: 'finance',
  budget: 'finance',
  health: 'health',
  wellness: 'health',
  fitness: 'health',
  friend: 'friendship',
  relationship: 'friendship',
  travel: 'travel',
  trip: 'travel',
  architecture: 'architecture',
  design: 'architecture',
  creative: 'creativity',
  art: 'creativity',
};

function hashSeed(parts: string[]): string {
  let h = 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 13)) | 0;
  }
  return `mirror-visual-${Math.abs(h).toString(36)}`;
}

export function inferSceneTopicKey(
  entries: SavedBehavioralEntry[],
  observationCategoryId?: UserObservationCategoryId,
  personaFamilyId?: PersonaFamilyId
): SceneTopicKey {
  const latest = [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  )[0];

  const obs = latest ? parseStandaloneObservation(latest.standaloneObservation) : null;
  if (obs?.user_pattern?.category) {
    const fromBackend = BACKEND_USER_PATTERN_TO_TOPIC[obs.user_pattern.category];
    if (fromBackend) return fromBackend;
  }

  const intent = (latest?.vector.intent ?? '').toLowerCase();
  for (const [key, topic] of Object.entries(INTENT_TO_TOPIC)) {
    if (intent.includes(key)) return topic;
  }

  const cat =
    observationCategoryId ??
    (entries.length ? classifyDayFromEntries(entries) : undefined);
  if (cat && CATEGORY_TO_TOPIC[cat]) {
    return CATEGORY_TO_TOPIC[cat]!;
  }

  if (personaFamilyId && PERSONA_TO_TOPIC_BIAS[personaFamilyId]) {
    return PERSONA_TO_TOPIC_BIAS[personaFamilyId]!;
  }

  return 'general';
}

export function inferEmotionLabel(
  energyLabel?: string,
  categoryId?: UserObservationCategoryId
): string {
  const e = (energyLabel ?? '').toLowerCase();
  if (e.includes('yüksek') || e.includes('odak')) return 'meraklı ve canlı';
  if (e.includes('dikkatli')) return 'dikkatli ve ölçülü';
  if (categoryId === 'sensitive_signals') return 'hassas ama dengeli';
  if (categoryId === 'creative_ideas' || categoryId === 'exploration') {
    return 'ilhamlı ve meraklı';
  }
  return DEFAULT_EMOTION_LABEL;
}

function buildIntentFirstSceneBlock(input: {
  topicKey: SceneTopicKey;
  intent: ConversationVisualIntent;
  atmosphereLabel: string;
  emotionLabel: string;
  characterName: string;
  personaFamilyId: PersonaFamilyId;
}): string[] {
  const preset = SCENE_TOPIC_PRESETS[input.topicKey];
  const characterPhrase = resolveSceneCharacterPhrase(
    input.intent,
    input.topicKey,
    input.personaFamilyId,
    input.characterName
  );
  /** Topic presets dropped mascot/terrace tokens — mizansen carries the scene (11J). */
  const useLegacyTopicElements = false;

  const isArchitecture =
    input.topicKey === 'architecture' ||
    input.intent.composition === 'restoration_scene';

  if (isArchitecture) {
    return [
      EZA_ARCHITECTURE_STYLE_CONTRACT,
      EZA_GLOBAL_STYLE_LOCK,
      input.intent.mizansen,
      ...input.intent.supportingElements,
      buildArchitectureStorytellingPhrase(input.characterName),
      ...EZA_ARCHITECTURE_CAMERA,
      `palette: ${preset.palette}`,
      `atmosphere: ${input.atmosphereLabel}`,
      `emotion mood: ${input.emotionLabel}`,
      ...EZA_ARCHITECTURE_OVERLAY_RULES,
    ];
  }

  const block = [
    ...buildVisualCanonLayers(),
    input.intent.mizansen,
    ...input.intent.supportingElements,
    ...(useLegacyTopicElements ? preset.sceneElements : []),
    `palette: ${preset.palette}`,
    `atmosphere: ${input.atmosphereLabel}`,
    `emotion mood: ${input.emotionLabel}`,
    characterPhrase,
    ...EZA_OVERLAY_LAYOUT_RULES,
  ];

  return block;
}

export function buildVisualPrompt(input: BuildVisualPromptInput): MirrorVisualPrompt {
  const preset = SCENE_TOPIC_PRESETS[input.topicKey];
  const atmosphereLabel = input.atmosphereLabel ?? preset.atmosphereDefault;
  const emotionLabel = input.emotionLabel ?? DEFAULT_EMOTION_LABEL;
  const topicLabel = SCENE_TOPIC_LABEL[input.topicKey];

  const intent =
    input.conversationIntent ??
    deriveConversationVisualIntent({
      entries: [],
      topicKey: input.topicKey,
    });

  const sceneBlock = buildIntentFirstSceneBlock({
    topicKey: input.topicKey,
    intent,
    atmosphereLabel,
    emotionLabel,
    characterName: input.characterName,
    personaFamilyId: input.personaFamilyId,
  });

  const prompt = sceneBlock.join(', ');
  const qualityHints =
    input.topicKey === 'architecture' ||
    intent.composition === 'restoration_scene'
      ? [...ARCHITECTURE_QUALITY_HINTS, `scene intent: ${intent.label}`]
      : [...VISUAL_QUALITY_HINTS, `scene intent: ${intent.label}`];

  return {
    characterId: input.characterId,
    characterName: input.characterName,
    personaFamilyId: input.personaFamilyId,
    topicLabel,
    atmosphereLabel,
    emotionLabel,
    prompt,
    negativePrompt: buildMirrorNegativePrompt(input.topicKey, intent.negativeExtras),
    stylePreset: STYLE_PRESET,
    seedHint: input.seedHint,
    qualityHints,
    sceneIntentLabel: intent.label,
  };
}

export interface BuildMirrorVisualFromContextInput {
  entries: SavedBehavioralEntry[];
  characterName: string;
  personaFamilyId: PersonaFamilyId;
  observationCategoryId?: UserObservationCategoryId;
  energyLabel?: string;
  seed: string;
  reflectionTone?: ReflectionToneId;
  atmosphereOverride?: string;
  emotionOverride?: string;
  toneHints?: string[];
  storyTopicKey?: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  reflectionSignals?: ReflectionSignals;
  visualStoryHints?: string[];
}

/**
 * Conversation-intent-first scene; topic presets only when intent is ambient.
 */
export function buildMirrorVisualFromContext(
  input: BuildMirrorVisualFromContextInput
): MirrorVisualPrompt {
  const topicKey = inferSceneTopicKey(
    input.entries,
    input.observationCategoryId,
    input.personaFamilyId
  );
  const reflectionSignals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);

  const conversationIntent = deriveConversationVisualIntent({
    entries: input.entries,
    topicKey,
    storyVariant: input.storyVariant,
    reflectionSignals,
    storyTopicKey: input.storyTopicKey,
  });

  const emotionLabel =
    input.emotionOverride ??
    inferEmotionLabel(input.energyLabel, input.observationCategoryId);
  const preset = SCENE_TOPIC_PRESETS[topicKey];

  const visual = buildVisualPrompt({
    characterId: input.personaFamilyId,
    characterName: input.characterName,
    personaFamilyId: input.personaFamilyId,
    topicKey,
    atmosphereLabel: input.atmosphereOverride ?? preset.atmosphereDefault,
    emotionLabel,
    seedHint: hashSeed([
      input.seed,
      input.personaFamilyId,
      topicKey,
      conversationIntent.id,
      input.characterName,
      input.reflectionTone ?? '',
    ]),
    conversationIntent,
  });

  const storyHints = input.visualStoryHints ?? [];
  const intentBlock = buildConversationScenePromptBlock(conversationIntent);
  const alignedStory =
    input.storyTopicKey && input.storyTopicKey === topicKey ? storyHints.slice(0, 2) : [];

  visual.prompt = [intentBlock, visual.prompt, ...alignedStory].filter(Boolean).join(', ');
  visual.qualityHints = [
    ...visual.qualityHints,
    ...input.toneHints ?? [],
    ...storyHints.slice(0, 2),
  ].slice(0, 16);

  return visual;
}

export function buildFallbackMirrorVisual(
  personaFamilyId: PersonaFamilyId = 'balanced_calm',
  characterName = '',
  seed = 'mirror-fallback'
): MirrorVisualPrompt {
  return buildVisualPrompt({
    characterId: personaFamilyId,
    characterName: characterName || 'Dengeli yolcu',
    personaFamilyId,
    topicKey: 'general',
    atmosphereLabel: DEFAULT_ATMOSPHERE_LABEL,
    emotionLabel: DEFAULT_EMOTION_LABEL,
    seedHint: hashSeed([seed, personaFamilyId, 'general']),
  });
}
