/**
 * Visual Narrative Director — conversation → cinematic essence (Sprint 13A).
 * Central layer: dramatic center, scene archetype, hero objects, safe zones.
 * Reflection tone may adjust light/tempo only — never swap primary archetype.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';
import { deriveConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import type { ConversationVisualIntentId } from '@/lib/eza/mirror/sceneIntentTypes';
import {
  collectIntentCueBlob,
  resolveLockedPrimaryIntent,
} from '@/lib/eza/mirror/intentLockSystem';
import {
  deriveReflectionSignals,
  type ReflectionSignals,
  type TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import { inferSceneTopicKey } from '@/lib/eza/mirror/visualPromptEngine';
import type { SceneSubtopicResolution } from '@/lib/eza/mirror/sceneSubtopicTypes';

export type VisualDensityId = 'sparse' | 'balanced' | 'rich' | 'high';

export type CameraEnergyId = 'calm' | 'layered' | 'active' | 'cinematic_tension';

export type VisualNarrativeDirection = {
  coreTension: string;
  visualEmotion: string;
  sceneArchetype: string;
  heroObjects: string[];
  characterRole: string;
  environment: string;
  compositionIntent: string;
  typographySafeZone: string;
  visualDensity: VisualDensityId;
  cameraEnergy: CameraEnergyId;
  forbiddenSceneTypes: string[];
};

export type DeriveVisualNarrativeInput = {
  entries: SavedBehavioralEntry[];
  topicKey?: SceneTopicKey;
  storyVariant?: TopicStoryVariantId;
  reflectionSignals?: ReflectionSignals;
  reflectionTone?: ReflectionToneId;
  personaFamilyId?: import('@/lib/eza/standalonePersonas').PersonaFamilyId;
  observationCategoryId?: import('@/lib/eza/dailyObservation').UserObservationCategoryId;
  sceneSubtopicResolution?: SceneSubtopicResolution;
};

type ArchetypeBlueprint = VisualNarrativeDirection & {
  id: string;
  intentIds: ConversationVisualIntentId[];
};

const TYPOGRAPHY_SAFE_DEFAULT =
  'upper-left and upper-center clean negative space, lower-third soft gradient readable zone, right-side subject placement, avoid high detail behind headline';

const ARCHETYPE_REGISTRY: ArchetypeBlueprint[] = [
  {
    id: 'luxury_comparison_studio',
    intentIds: ['premium_vehicle_comparison'],
    coreTension: 'konfor ve sürüş karakteri arasında karar verme',
    visualEmotion: 'controlled analytical calm',
    sceneArchetype: 'luxury comparison studio',
    heroObjects: [
      'two premium executive sedans',
      'comparison board',
      'comfort priority cues',
    ],
    characterRole: 'thoughtful person evaluating two options between the cars, not posing',
    environment: 'warm premium indoor showroom or garage studio',
    compositionIntent: 'dual comparison, human between two objects',
    typographySafeZone:
      'upper-left and upper-center clean negative space, lower-third soft gradient readable zone, right-side subject placement, avoid high detail behind headline',
    visualDensity: 'high',
    cameraEnergy: 'cinematic_tension',
    forbiddenSceneTypes: [
      'city street',
      'road',
      'highway',
      'pier',
      'seascape',
      'empty landscape',
      'single portrait',
      'skyline',
      'urban avenue',
    ],
  },
  {
    id: 'restoration_material_study',
    intentIds: ['restoration_research'],
    coreTension: 'malzeme uyumu ve dayanıklılık arasında seçim',
    visualEmotion: 'focused craft curiosity',
    sceneArchetype: 'restoration material study',
    heroObjects: ['stone samples', 'lime mortar', 'rolled sketches', 'wooden worktable'],
    characterRole: 'designer examining material compatibility, hands on samples',
    environment: 'historic stone courtyard or restoration atelier',
    compositionIntent: 'over-shoulder craft research',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'rich',
    cameraEnergy: 'layered',
    forbiddenSceneTypes: ['city street', 'generic office', 'vehicle showroom', 'beach'],
  },
  {
    id: 'warm_culinary_wellness_preparation',
    intentIds: ['culinary_wellness'],
    coreTension: 'özenli beslenme ile pratik hazırlık arasında denge',
    visualEmotion: 'warm mindful care',
    sceneArchetype: 'warm culinary wellness preparation',
    heroObjects: [
      'gluten-free dessert ingredients',
      'mixing bowl',
      'berries',
      'ceramic plate',
    ],
    characterRole: 'person preparing food with care, mid-action not posing',
    environment: 'warm natural light kitchen',
    compositionIntent: 'intimate preparation scene',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'balanced',
    cameraEnergy: 'layered',
    forbiddenSceneTypes: ['restaurant UI', 'fast food', 'empty portrait', 'highway'],
  },
  {
    id: 'journey_planning_threshold',
    intentIds: ['travel_planning'],
    coreTension: 'rota ve zaman arasında net bir yön seçme',
    visualEmotion: 'anticipatory discovery',
    sceneArchetype: 'journey planning threshold',
    heroObjects: ['map', 'ticket', 'train platform', 'small luggage'],
    characterRole: 'traveler deciding route, leaning toward departure light',
    environment: 'train station at golden hour',
    compositionIntent: 'leading lines toward horizon',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'rich',
    cameraEnergy: 'active',
    forbiddenSceneTypes: ['airport dashboard UI', 'tourist postcard cliché', 'empty beach'],
  },
  {
    id: 'quiet_reflective_threshold',
    intentIds: ['soft_reflection', 'wellness_calm'],
    coreTension: 'içe dönük netlik arayışı acele etmeden',
    visualEmotion: 'soft contemplative pause',
    sceneArchetype: 'quiet reflective threshold',
    heroObjects: ['open notebook', 'tea cup', 'window light'],
    characterRole: 'person pausing before writing, reflective not idle',
    environment: 'quiet interior by window',
    compositionIntent: 'asymmetric calm, not empty',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'sparse',
    cameraEnergy: 'calm',
    forbiddenSceneTypes: ['busy dashboard', 'comparison board', 'vehicle showroom', 'crowd street'],
  },
  {
    id: 'product_comparison_studio',
    intentIds: ['product_comparison'],
    coreTension: 'iki seçenek arasında ölçülü karar',
    visualEmotion: 'analytical comparison calm',
    sceneArchetype: 'product comparison studio',
    heroObjects: ['two premium product silhouettes', 'comparison notes', 'matte plinth'],
    characterRole: 'decision-maker studying two options side by side',
    environment: 'soft-lit editorial product studio',
    compositionIntent: 'dual comparison with human guide',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'rich',
    cameraEnergy: 'active',
    forbiddenSceneTypes: ['city street', 'mascot portrait', 'empty landscape'],
  },
  {
    id: 'financial_decision_desk',
    intentIds: ['financial_decision'],
    coreTension: 'bütçe ve risk arasında kontrollü netlik',
    visualEmotion: 'measured planning focus',
    sceneArchetype: 'financial decision study',
    heroObjects: ['comparison notebook', 'calculator', 'organized columns', 'walnut desk'],
    characterRole: 'person leaning over desk comparing options analytically',
    environment: 'warm golden-hour planning desk',
    compositionIntent: 'desk study with readable negative space left',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'balanced',
    cameraEnergy: 'layered',
    forbiddenSceneTypes: ['dark trading floor UI', 'city street', 'vehicle exterior'],
  },
  {
    id: 'friendship_connection_bridge',
    intentIds: ['friendship_reflection'],
    coreTension: 'bağ kurma ve anlaşılma arasında yumuşak adım',
    visualEmotion: 'empathetic warmth',
    sceneArchetype: 'friendship connection scene',
    heroObjects: ['shared bench', 'lake light', 'two presences at distance'],
    characterRole: 'two figures in empathetic conversation scale not portrait',
    environment: 'lakeside bridge golden hour',
    compositionIntent: 'human scale connection wide mid shot',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'balanced',
    cameraEnergy: 'calm',
    forbiddenSceneTypes: ['dating app UI', 'crowd street', 'vehicle showroom'],
  },
  {
    id: 'creative_ideation_flow',
    intentIds: ['creative_brainstorm'],
    coreTension: 'fikir akışı ile netleştirme arasında enerji',
    visualEmotion: 'curious creative momentum',
    sceneArchetype: 'creative ideation atmosphere',
    heroObjects: ['sketch pages', 'material swatches', 'desk lamp', 'draft boards'],
    characterRole: 'creator mid-sketch not posing for camera',
    environment: 'atelier with soft side light',
    compositionIntent: 'layered desk depth with subject right',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'rich',
    cameraEnergy: 'active',
    forbiddenSceneTypes: ['neon game UI', 'empty portrait', 'highway'],
  },
  {
    id: 'deep_research_focus',
    intentIds: ['deep_research'],
    coreTension: 'detay ve anlam arasında derinlemesine bakış',
    visualEmotion: 'intellectual focus',
    sceneArchetype: 'deep research study',
    heroObjects: ['open books', 'annotated notes', 'lamp', 'reference stack'],
    characterRole: 'researcher leaning into material study',
    environment: 'quiet study with warm lamp pool',
    compositionIntent: 'over-shoulder analytical depth',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'rich',
    cameraEnergy: 'layered',
    forbiddenSceneTypes: ['empty stock photo desk', 'city aerial', 'showroom'],
  },
  {
    id: 'topic_atmosphere_editorial',
    intentIds: ['topic_atmosphere'],
    coreTension: 'günün temasına uygun sakin görsel özet',
    visualEmotion: 'editorial observational calm',
    sceneArchetype: 'topic atmosphere editorial',
    heroObjects: ['topic-relevant objects', 'window light', 'notebook'],
    characterRole: 'human integrated in scene under thirty-five percent frame',
    environment: 'premium editorial interior with natural light',
    compositionIntent: 'environment-first with readable overlay zones',
    typographySafeZone: TYPOGRAPHY_SAFE_DEFAULT,
    visualDensity: 'balanced',
    cameraEnergy: 'calm',
    forbiddenSceneTypes: ['generic mascot', 'AI wallpaper', 'dashboard UI'],
  },
];

const INTENT_TO_ARCHETYPE = new Map<ConversationVisualIntentId, string>(
  ARCHETYPE_REGISTRY.flatMap((bp) => bp.intentIds.map((id) => [id, bp.id] as const))
);

function cloneBlueprint(bp: ArchetypeBlueprint): VisualNarrativeDirection {
  return {
    coreTension: bp.coreTension,
    visualEmotion: bp.visualEmotion,
    sceneArchetype: bp.sceneArchetype,
    heroObjects: [...bp.heroObjects],
    characterRole: bp.characterRole,
    environment: bp.environment,
    compositionIntent: bp.compositionIntent,
    typographySafeZone: bp.typographySafeZone,
    visualDensity: bp.visualDensity,
    cameraEnergy: bp.cameraEnergy,
    forbiddenSceneTypes: [...bp.forbiddenSceneTypes],
  };
}

function findBlueprint(archetypeId: string): ArchetypeBlueprint {
  return (
    ARCHETYPE_REGISTRY.find((bp) => bp.id === archetypeId) ??
    ARCHETYPE_REGISTRY.find((bp) => bp.id === 'topic_atmosphere_editorial')!
  );
}

function hasFriendshipCue(blob: string): boolean {
  return ['friend', 'friendship', 'empathy', 'bağ', 'ilişki', 'communicat'].some((c) =>
    blob.includes(c)
  );
}

function resolvePrimaryArchetypeId(
  lockedIntent: ReturnType<typeof resolveLockedPrimaryIntent>,
  intentId: ConversationVisualIntentId,
  cueBlob: string,
  signals: ReflectionSignals
): string {
  if (lockedIntent === 'premium_vehicle_comparison') {
    return 'luxury_comparison_studio';
  }

  if (intentId === 'soft_reflection' || intentId === 'wellness_calm') {
    return 'quiet_reflective_threshold';
  }

  if (
    intentId === 'friendship_reflection' &&
    !hasFriendshipCue(cueBlob) &&
    signals.calmnessLevel >= 0.5 &&
    signals.comparisonIntensity < 0.3
  ) {
    return 'quiet_reflective_threshold';
  }

  return INTENT_TO_ARCHETYPE.get(intentId) ?? 'topic_atmosphere_editorial';
}

/**
 * Reflection tone adjusts light/tempo only — never primary scene archetype.
 */
export function applyReflectionToneToNarrative(
  direction: VisualNarrativeDirection,
  reflectionTone: ReflectionToneId | undefined,
  signals: ReflectionSignals
): VisualNarrativeDirection {
  if (!reflectionTone) return direction;

  let visualEmotion = direction.visualEmotion;
  let cameraEnergy = direction.cameraEnergy;

  if (reflectionTone === 'calm_reflective' || reflectionTone === 'mentally_tired') {
    visualEmotion = `${direction.visualEmotion}, softened warm light slower tempo`;
    if (cameraEnergy === 'cinematic_tension') {
      cameraEnergy = signals.comparisonIntensity >= 0.5 ? 'cinematic_tension' : 'layered';
    } else if (cameraEnergy === 'active') {
      cameraEnergy = 'layered';
    }
  } else if (reflectionTone === 'focused_growth' || reflectionTone === 'quietly_confident') {
    visualEmotion = `${direction.visualEmotion}, crisp confident clarity`;
  } else if (reflectionTone === 'curious_light') {
    visualEmotion = `${direction.visualEmotion}, gentle curious lift`;
    if (cameraEnergy === 'calm') cameraEnergy = 'layered';
  }

  return {
    ...direction,
    sceneArchetype: direction.sceneArchetype,
    environment: direction.environment,
    heroObjects: direction.heroObjects,
    visualEmotion,
    cameraEnergy,
  };
}

/**
 * Derive cinematic narrative direction from conversation behavioral history.
 */
export function deriveVisualNarrativeDirection(
  input: DeriveVisualNarrativeInput
): VisualNarrativeDirection {
  const reflectionSignals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);
  const topicKey =
    input.topicKey ??
    inferSceneTopicKey(
      input.entries,
      input.observationCategoryId,
      input.personaFamilyId ?? 'balanced_calm'
    );
  const cueBlob = collectIntentCueBlob(input.entries);
  const lockedIntent = resolveLockedPrimaryIntent({
    entries: input.entries,
    reflectionSignals,
    storyVariant: input.storyVariant,
    cueBlob,
  });

  const conversationIntent = deriveConversationVisualIntent({
    entries: input.entries,
    topicKey,
    storyVariant: input.storyVariant,
    reflectionSignals,
    storyTopicKey: topicKey,
  });

  const primaryIntentId =
    lockedIntent ?? conversationIntent.id;

  const archetypeId = resolvePrimaryArchetypeId(
    lockedIntent,
    primaryIntentId,
    cueBlob,
    reflectionSignals
  );
  const base = cloneBlueprint(findBlueprint(archetypeId));

  if (lockedIntent === 'premium_vehicle_comparison' && cueBlob.includes('konfor')) {
    base.coreTension = 'konfor ve uzun yol önceliği ile sürüş karakteri arasında karar';
    if (!base.heroObjects.includes('comfort priority cues')) {
      base.heroObjects.push('comfort priority cues');
    }
  }

  const toned = applyReflectionToneToNarrative(
    base,
    input.reflectionTone,
    reflectionSignals
  );

  return applySceneSubtopicToNarrative(toned, input.sceneSubtopicResolution);
}

/** Refine hero objects and environment from whitelist subtopic keywords. */
export function applySceneSubtopicToNarrative(
  direction: VisualNarrativeDirection,
  subtopic?: SceneSubtopicResolution
): VisualNarrativeDirection {
  if (!subtopic || subtopic.primarySubtopic === 'topic_generic' || subtopic.confidence < 0.35) {
    return direction;
  }

  const next: VisualNarrativeDirection = { ...direction };

  if (subtopic.environmentOverride) {
    next.environment = subtopic.environmentOverride;
  }

  if (subtopic.heroObjectOverrides?.length) {
    next.heroObjects = [...subtopic.heroObjectOverrides];
  }

  if (subtopic.sceneKeywords.length) {
    const keywordHint = subtopic.sceneKeywords.slice(0, 4).join(', ');
    next.coreTension = `${direction.coreTension}, visual world: ${keywordHint}`;
  }

  return next;
}

/** Dev / test helper — archetype id for assertions. */
export function resolveNarrativeArchetypeId(input: DeriveVisualNarrativeInput): string {
  const reflectionSignals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);
  const lockedIntent = resolveLockedPrimaryIntent({
    entries: input.entries,
    reflectionSignals,
    storyVariant: input.storyVariant,
    cueBlob: collectIntentCueBlob(input.entries),
  });
  const intent = deriveConversationVisualIntent({
    entries: input.entries,
    topicKey: input.topicKey ?? 'general',
    reflectionSignals,
    storyVariant: input.storyVariant,
  });
  const cueBlob = collectIntentCueBlob(input.entries);
  const signals =
    input.reflectionSignals ?? deriveReflectionSignals(input.entries);
  return resolvePrimaryArchetypeId(
    lockedIntent,
    lockedIntent ?? intent.id,
    cueBlob,
    signals
  );
}
