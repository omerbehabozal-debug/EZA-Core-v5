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
import { buildScenePromptFromDirector } from '@/lib/eza/mirror/compositionContractBuilder';
import { buildHybridPosterPrompt } from '@/lib/eza/mirror/hybridPosterPromptBuilder';
import type { HybridPosterTextPayload } from '@/lib/eza/mirror/hybridPosterPromptBuilder';
import {
  detectPromptTruncationRisk,
  logHybridPromptBuilt,
  type UsedPromptType,
} from '@/lib/eza/mirror/hybridPosterDebug';
import { resolveMirrorRenderMode, type MirrorRenderMode } from '@/lib/eza/mirror/mirrorRenderMode';
import { buildEmotionalSceneBlock } from '@/lib/eza/mirror/emotionalSceneEngine';
import { deriveVisualNarrativeDirection } from '@/lib/eza/mirror/visualNarrativeDirector';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';
import {
  enforceVehicleComparisonPrompt,
  VEHICLE_SCENE_CONTRACT_ID,
} from '@/lib/eza/mirror/vehicleSceneContract';
import { resolveMirrorIntentContext } from '@/lib/eza/mirror/mirrorIntentContext';
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
  lockedPrimaryIntent?: LockedPrimaryIntentId;
  primaryIntentId?: ConversationVisualIntent['id'];
  compositionTemplate?: ConversationVisualIntent['composition'];
  intentFingerprint?: string;
  sceneContractId?: string;
  renderMode?: MirrorRenderMode;
  hybridTextPayload?: HybridPosterTextPayload;
  hybridTextRisk?: boolean;
  hybridFallbackReason?: string;
  usedPromptType?: UsedPromptType;
  promptTruncated?: boolean;
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
  emotionalPrompt?: string;
  characterRolePhrase?: string;
}): string[] {
  const preset = SCENE_TOPIC_PRESETS[input.topicKey];
  const characterPhrase =
    input.characterRolePhrase ??
    resolveSceneCharacterPhrase(
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
      ...(input.emotionalPrompt ? [input.emotionalPrompt] : []),
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
    ...(input.emotionalPrompt ? [input.emotionalPrompt] : []),
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
  lockedIntent?: LockedPrimaryIntentId;
  intentFingerprint?: string;
  renderMode?: MirrorRenderMode;
  hybridCopy?: HybridPosterTextPayload;
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

  const hasPrelocked =
    Boolean(input.intentFingerprint) && input.lockedIntent !== undefined;
  const intentCtx = hasPrelocked
    ? null
    : resolveMirrorIntentContext({
          entries: input.entries,
          storyVariant: input.storyVariant,
          reflectionSignals,
          reflectionTone: input.reflectionTone,
          personaFamilyId: input.personaFamilyId,
          observationCategoryId: input.observationCategoryId,
        });

  const lockedIntent = input.lockedIntent ?? intentCtx?.lockedIntent ?? null;
  const intentFingerprint = input.intentFingerprint ?? intentCtx?.intentFingerprint ?? '';

  const conversationIntent =
    intentCtx?.conversationIntent ??
    deriveConversationVisualIntent({
    entries: input.entries,
    topicKey,
    storyVariant: input.storyVariant,
    reflectionSignals,
      storyTopicKey: input.storyTopicKey,
    });

  const emotionalScene = buildEmotionalSceneBlock({
    intent: conversationIntent,
    reflectionSignals,
    storyVariant: input.storyVariant,
    reflectionTone: input.reflectionTone,
    lockedIntent,
  });

  const emotionLabel =
    input.emotionOverride ??
    inferEmotionLabel(input.energyLabel, input.observationCategoryId);
  const preset = SCENE_TOPIC_PRESETS[topicKey];

  const atmosphereLabel = input.atmosphereOverride ?? preset.atmosphereDefault;

  const narrative = deriveVisualNarrativeDirection({
    entries: input.entries,
    topicKey,
    storyVariant: input.storyVariant,
    reflectionSignals,
    reflectionTone: input.reflectionTone,
    personaFamilyId: input.personaFamilyId,
    observationCategoryId: input.observationCategoryId,
  });

  const renderMode = input.renderMode ?? resolveMirrorRenderMode();

  let structured: { prompt: string; negativePrompt: string };
  let hybridTextPayload: HybridPosterTextPayload | undefined;
  let usedPromptType: UsedPromptType = 'scene_only_director';

  if (renderMode === 'hybrid_middle' && input.hybridCopy) {
    const hybrid = buildHybridPosterPrompt({
      narrative,
      headline: input.hybridCopy.headline,
      subheadline: input.hybridCopy.subheadline,
      description: input.hybridCopy.description,
      themeTitle: input.hybridCopy.themeTitle,
      themeDescription: input.hybridCopy.themeDescription,
      quote: input.hybridCopy.quote,
      sceneIntent: conversationIntent.label,
      heroObjects: narrative.heroObjects,
      colorMood: atmosphereLabel,
      typographyStyle:
        'premium editorial Turkish typography, warm cream and soft violet, integrated with scene',
      lockedIntent,
    });
    structured = { prompt: hybrid.prompt, negativePrompt: hybrid.negativePrompt };
    hybridTextPayload = hybrid.textPayload;
    usedPromptType = 'hybrid_middle';
  } else {
    if (renderMode === 'hybrid_middle' && !input.hybridCopy && process.env.NODE_ENV === 'development') {
      console.warn(
        '[EZA Mirror] hybrid_middle requested but hybridCopy missing — falling back to scene_only_director'
      );
    }
    structured = buildScenePromptFromDirector({
      narrative,
      topicKey,
      intent: conversationIntent,
      emotionalBlock: emotionalScene,
      reflectionSignals,
      atmosphereLabel,
      emotionLabel,
      lockedIntent,
    });
  }

  const architectureExtra =
    topicKey === 'architecture' || conversationIntent.composition === 'restoration_scene'
      ? [EZA_ARCHITECTURE_STYLE_CONTRACT, ...ARCHITECTURE_QUALITY_HINTS].join(', ')
      : '';

  const prompt = [structured.prompt, architectureExtra].filter(Boolean).join(' ');
  const promptTruncated = detectPromptTruncationRisk(prompt).truncated;

  const qualityHints =
    topicKey === 'architecture' ||
    conversationIntent.composition === 'restoration_scene'
      ? [...ARCHITECTURE_QUALITY_HINTS, `scene intent: ${conversationIntent.label}`]
      : [...VISUAL_QUALITY_HINTS, `scene intent: ${conversationIntent.label}`];

  qualityHints.push(
    `hero object: ${emotionalScene.heroObjectLabel}`,
    `tension: ${emotionalScene.tension}`,
    `pacing: ${emotionalScene.pacing}`,
    `camera: ${emotionalScene.cameraLabel.slice(0, 48)}`,
    'director-led prompt 13B',
    `scene archetype: ${narrative.sceneArchetype}`,
    renderMode === 'hybrid_middle' ? 'hybrid middle poster 13C' : 'scene-only textless'
  );

  const visual: MirrorVisualPrompt = {
    characterId: input.personaFamilyId,
    characterName: input.characterName,
    personaFamilyId: input.personaFamilyId,
    topicLabel: SCENE_TOPIC_LABEL[topicKey],
    atmosphereLabel,
    emotionLabel,
    prompt,
    negativePrompt: structured.negativePrompt,
    stylePreset: STYLE_PRESET,
    seedHint: hashSeed([
      input.seed,
      input.personaFamilyId,
      topicKey,
      conversationIntent.id,
      lockedIntent ?? 'none',
      intentFingerprint,
      input.characterName,
      input.reflectionTone ?? '',
      emotionalScene.tension,
      emotionalScene.pacing,
    ]),
    qualityHints,
    sceneIntentLabel: conversationIntent.label,
    lockedPrimaryIntent: lockedIntent,
    primaryIntentId: conversationIntent.id,
    compositionTemplate: conversationIntent.composition,
    intentFingerprint,
    sceneContractId:
      lockedIntent === 'premium_vehicle_comparison' ? VEHICLE_SCENE_CONTRACT_ID : undefined,
    renderMode,
    hybridTextPayload,
    usedPromptType,
    promptTruncated,
  };

  if (usedPromptType === 'scene_only_director' && process.env.NODE_ENV === 'development') {
    logHybridPromptBuilt({
      renderMode,
      usedPromptType,
      prompt: visual.prompt,
      negativePrompt: visual.negativePrompt,
    });
  }

  const storyHints = input.visualStoryHints ?? [];
  const alignedStory =
    input.storyTopicKey && input.storyTopicKey === topicKey ? storyHints.slice(0, 2) : [];
  const outdoorNoise =
    /\b(city|street|road|skyline|pier|dock|seascape|landscape|highway|urban|terrace)\b/i;
  const safeStory =
    lockedIntent === 'premium_vehicle_comparison'
      ? alignedStory.filter((h) => !outdoorNoise.test(h))
      : alignedStory;

  if (renderMode === 'hybrid_middle') {
    visual.prompt = [visual.prompt, ...safeStory].filter(Boolean).join(', ');
  } else {
    visual.prompt = enforceVehicleComparisonPrompt(
      [visual.prompt, ...safeStory].filter(Boolean).join(', '),
      lockedIntent
    );
    if (narrative.sceneArchetype === 'luxury comparison studio') {
      visual.sceneContractId = VEHICLE_SCENE_CONTRACT_ID;
    }
  }
  visual.qualityHints = [
    ...visual.qualityHints,
    ...input.toneHints ?? [],
    ...storyHints.slice(0, 2),
  ].slice(0, 18);

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
