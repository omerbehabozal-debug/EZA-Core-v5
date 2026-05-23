/**
 * Composition Contract + layout-aware scene prompt (Sprint 13B).
 * Bridges VisualNarrativeDirector → OpenAI image prompt pipeline.
 */

import type { ConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import type { EmotionalSceneBlock } from '@/lib/eza/mirror/emotionalSceneEngine';
import type { ReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import { buildMirrorNegativePrompt } from '@/lib/eza/mirror/ezaVisualCanon';
import {
  buildIntentLockPromptBlock,
  getIntentLockForbiddenPhrases,
  type LockedPrimaryIntentId,
} from '@/lib/eza/mirror/intentLockSystem';
import { enforceVehicleComparisonPrompt } from '@/lib/eza/mirror/vehicleSceneContract';
import type {
  CameraEnergyId,
  VisualDensityId,
  VisualNarrativeDirection,
} from '@/lib/eza/mirror/visualNarrativeDirector';
import {
  FIXED_NEGATIVE_SCENE,
  LIGHTING_BLOCK,
  STYLE_BLOCK,
} from '@/lib/eza/mirror/posterPromptBlocks';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';

export type CompositionContract = {
  requiredObjects: string[];
  requiredEnvironment: string;
  characterBlocking: string;
  cameraDirection: string;
  typographySafeZone: string;
  visualDensityRule: string;
  forbiddenSceneTypes: string[];
  promptOpening: string;
  promptConstraints: string[];
};

const SAFE_ZONE_STANDARD = [
  'leave clean upper-left area for typography overlay',
  'avoid high contrast details behind title',
  'keep lower third readable for subtle overlay text',
  'do not place important faces directly under text zones',
] as const;

export const LAYOUT_AWARE_POSTER_RULES = [
  'scene is a background for an EZA Mirror poster',
  'no text, no labels, no readable writing in the image',
  'leave clean upper-left typography safe area',
  'avoid busy detail behind headline area',
  'keep hero objects visible in lower and mid scene',
  'keep subject or character on right or center-right when possible',
  'maintain foreground midground background depth',
  'do not generate UI or card layout in the image',
  ...SAFE_ZONE_STANDARD,
] as const;

const DENSITY_RULES: Record<VisualDensityId, string> = {
  sparse: 'sparse visual density, 2 to 4 hero and support objects, generous breathing room',
  balanced: 'balanced visual density, 3 to 5 meaningful objects, readable composition',
  rich: 'rich visual density, 4 to 6 meaningful objects, layered but clear',
  high: 'high visual density, 5 to 8 meaningful objects, clean composition not chaotic',
};

const CAMERA_BY_ENERGY: Record<CameraEnergyId, string> = {
  calm: '50mm gentle editorial lens, soft depth, calm framing, subject on right or center-right',
  layered:
    '35mm cinematic lens, layered depth, foreground midground background separation, clean left overlay space',
  active:
    '35mm cinematic lens, dynamic editorial framing, subject on right or center-right, shallow depth of field',
  cinematic_tension:
    '35mm cinematic low three-quarter angle, dual object composition, foreground midground separation, editorial tension',
};

const OPENING_BY_ARCHETYPE: Record<string, string> = {
  'luxury comparison studio':
    'Create a premium cinematic editorial scene about a comfort-focused vehicle comparison decision.',
  'restoration material study':
    'Create a premium cinematic editorial scene about heritage material compatibility and restoration craft.',
  'warm culinary wellness preparation':
    'Create a warm cinematic editorial scene about mindful culinary preparation and wellness choices.',
  'journey planning threshold':
    'Create a cinematic editorial scene about journey planning and route decision.',
  'quiet reflective threshold':
    'Create a quiet cinematic editorial scene about reflective pause and inner clarity.',
  'product comparison studio':
    'Create a premium editorial scene about thoughtful product comparison.',
  'financial decision study':
    'Create a cinematic editorial scene about measured financial decision study.',
};

function buildPromptOpening(direction: VisualNarrativeDirection): string {
  return (
    OPENING_BY_ARCHETYPE[direction.sceneArchetype] ??
    `Create a premium cinematic editorial scene expressing: ${direction.coreTension}.`
  );
}

export function buildCompositionContract(
  direction: VisualNarrativeDirection
): CompositionContract {
  return {
    requiredObjects: [...direction.heroObjects],
    requiredEnvironment: direction.environment,
    characterBlocking: direction.characterRole,
    cameraDirection: CAMERA_BY_ENERGY[direction.cameraEnergy],
    typographySafeZone: direction.typographySafeZone,
    visualDensityRule: DENSITY_RULES[direction.visualDensity],
    forbiddenSceneTypes: [...direction.forbiddenSceneTypes],
    promptOpening: buildPromptOpening(direction),
    promptConstraints: [
      ...LAYOUT_AWARE_POSTER_RULES,
      `composition intent: ${direction.compositionIntent}`,
      `visual emotion: ${direction.visualEmotion}`,
      `core tension: ${direction.coreTension}`,
      `scene archetype: ${direction.sceneArchetype}`,
    ],
  };
}

export type BuildScenePromptFromDirectorInput = {
  narrative: VisualNarrativeDirection;
  topicKey: SceneTopicKey;
  intent: ConversationVisualIntent;
  emotionalBlock: EmotionalSceneBlock;
  reflectionSignals: ReflectionSignals;
  atmosphereLabel: string;
  emotionLabel: string;
  lockedIntent?: LockedPrimaryIntentId;
};

function filterActionPhrases(
  phrases: string[],
  forbidden: readonly string[],
  lockedIntent?: LockedPrimaryIntentId
): string {
  const outdoorNoise =
    /\b(city|street|road|skyline|pier|dock|seascape|landscape|highway|urban|terrace|avenue)\b/i;
  return phrases
    .filter((p) => !p.startsWith('camera grammar'))
    .filter((p) => {
      if (lockedIntent === 'premium_vehicle_comparison' && outdoorNoise.test(p)) {
        return false;
      }
      return !forbidden.some((f) => p.toLowerCase().includes(f));
    })
    .slice(0, 6)
    .join(', ');
}

/**
 * Director-led layout-aware scene prompt (13B order).
 */
export function buildScenePromptFromDirector(
  input: BuildScenePromptFromDirectorInput
): { prompt: string; negativePrompt: string } {
  const contract = buildCompositionContract(input.narrative);
  const intentLock = buildIntentLockPromptBlock(input.lockedIntent ?? null);

  const actionPhrases = filterActionPhrases(
    input.emotionalBlock.phrases,
    contract.forbiddenSceneTypes,
    input.lockedIntent
  );

  const actionMemory = [
    'scene captures one remembered moment from today AI dialogue',
    actionPhrases,
    'not a chat screenshot not message bubbles not UI overlay',
  ]
    .filter(Boolean)
    .join(', ');

  const promptParts = [
    intentLock ? `INTENT LOCK: ${intentLock}` : '',
    `COMPOSITION CONTRACT OPENING: ${contract.promptOpening}`,
    `REQUIRED OBJECTS: ${contract.requiredObjects.join(', ')}`,
    `ENVIRONMENT: ${contract.requiredEnvironment}`,
    `CHARACTER BLOCKING: ${contract.characterBlocking}`,
    `CAMERA DIRECTION: ${contract.cameraDirection}`,
    `TYPOGRAPHY SAFE ZONE: ${contract.typographySafeZone}`,
    `VISUAL DENSITY: ${contract.visualDensityRule}`,
    `LAYOUT AWARE RULES: ${contract.promptConstraints.join(', ')}`,
    `ACTION MEMORY: ${actionMemory}`,
    `STYLE CANON: ${STYLE_BLOCK}, ${LIGHTING_BLOCK}`,
    `ATMOSPHERE: ${input.atmosphereLabel}, emotion mood: ${input.emotionLabel}`,
    '9:16 vertical poster-ready textless background only',
  ].filter(Boolean);

  let prompt = promptParts.join(' ');

  prompt = enforceVehicleComparisonPrompt(prompt, input.lockedIntent ?? null);

  const negativeExtras = [
    ...contract.forbiddenSceneTypes,
    ...getIntentLockForbiddenPhrases(input.lockedIntent ?? null),
    ...input.intent.negativeExtras,
    ...input.emotionalBlock.negativeExtras,
    ...FIXED_NEGATIVE_SCENE.split(', '),
  ];

  const negativePrompt = buildMirrorNegativePrompt(input.topicKey, negativeExtras);

  return { prompt, negativePrompt };
}
