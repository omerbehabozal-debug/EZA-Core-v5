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
  SCENE_TOPIC_LABEL,
  SCENE_TOPIC_PRESETS,
  type SceneTopicKey,
} from '@/lib/eza/mirror/visualPromptPresets';
import { buildCharacterBiblePhrase, resolveCharacterArchetype } from '@/lib/eza/mirror/ezaCharacterBible';
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
}

export interface BuildVisualPromptInput {
  characterId: PersonaFamilyId;
  characterName: string;
  personaFamilyId: PersonaFamilyId;
  topicKey: SceneTopicKey;
  atmosphereLabel?: string;
  emotionLabel?: string;
  seedHint: string;
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

export function buildVisualPrompt(input: BuildVisualPromptInput): MirrorVisualPrompt {
  const preset = SCENE_TOPIC_PRESETS[input.topicKey];
  const atmosphereLabel = input.atmosphereLabel ?? preset.atmosphereDefault;
  const emotionLabel = input.emotionLabel ?? DEFAULT_EMOTION_LABEL;
  const topicLabel = SCENE_TOPIC_LABEL[input.topicKey];

  const archetype = resolveCharacterArchetype(input.topicKey, input.personaFamilyId);

  const sceneBlock =
    input.topicKey === 'architecture'
      ? [
          EZA_ARCHITECTURE_STYLE_CONTRACT,
          EZA_GLOBAL_STYLE_LOCK,
          ...EZA_ARCHITECTURE_CAMERA,
          ...preset.sceneElements,
          buildArchitectureStorytellingPhrase(input.characterName),
          `palette: ${preset.palette}`,
          `atmosphere: ${atmosphereLabel}`,
          `emotion mood: ${emotionLabel}`,
          ...EZA_ARCHITECTURE_OVERLAY_RULES,
        ]
      : [
          ...buildVisualCanonLayers(),
          ...preset.sceneElements,
          `palette: ${preset.palette}`,
          `atmosphere: ${atmosphereLabel}`,
          `emotion mood: ${emotionLabel}`,
          buildCharacterBiblePhrase(archetype, input.characterName),
          ...EZA_OVERLAY_LAYOUT_RULES,
        ];

  const prompt = sceneBlock.join(', ');
  const qualityHints =
    input.topicKey === 'architecture'
      ? [...ARCHITECTURE_QUALITY_HINTS]
      : [...VISUAL_QUALITY_HINTS];

  return {
    characterId: input.characterId,
    characterName: input.characterName,
    personaFamilyId: input.personaFamilyId,
    topicLabel,
    atmosphereLabel,
    emotionLabel,
    prompt,
    negativePrompt: buildMirrorNegativePrompt(input.topicKey),
    stylePreset: STYLE_PRESET,
    seedHint: input.seedHint,
    qualityHints,
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
  visualStoryHints?: string[];
}

/**
 * Character from behavior pattern; topic drives scene/atmosphere only.
 */
export function buildMirrorVisualFromContext(
  input: BuildMirrorVisualFromContextInput
): MirrorVisualPrompt {
  const topicKey = inferSceneTopicKey(
    input.entries,
    input.observationCategoryId,
    input.personaFamilyId
  );
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
      input.characterName,
      input.reflectionTone ?? '',
    ]),
  });

  const storyHints = input.visualStoryHints ?? [];
  const mergedHints = [...visual.qualityHints, ...input.toneHints ?? [], ...storyHints];
  if (mergedHints.length) {
    visual.qualityHints = mergedHints.slice(0, 14);
  }

  if (input.storyTopicKey && input.storyTopicKey === topicKey) {
    visual.prompt = [visual.prompt, ...storyHints.slice(0, 3)].filter(Boolean).join(', ');
  }

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

