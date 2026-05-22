/**
 * Emotional Scene Intelligence + cinematic direction (Sprint 11N / 11O).
 * Five layers: intent · hero · character · composition · cinematic pacing.
 */

import type { ConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import { buildCinematicDirectionBlock } from '@/lib/eza/mirror/cinematicDirectionSystem';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';
import { resolveHeroObject } from '@/lib/eza/mirror/heroObjectRegistry';
import {
  buildDepthLayerPhrases,
  getIntentCompositionSpec,
  getTensionPhrase,
  resolveEmotionalTension,
  type EmotionalTensionId,
} from '@/lib/eza/mirror/intentCompositionSystem';
import type { EmotionalPacingId } from '@/lib/eza/mirror/emotionalPacingEngine';
import type {
  ReflectionSignals,
  TopicStoryVariantId,
} from '@/lib/eza/mirror/reflectionSignals';
import type { MicroMoodId } from '@/lib/eza/mirror/reflectionSignals';
import type { LockedPrimaryIntentId } from '@/lib/eza/mirror/intentLockSystem';

export type EmotionalSceneBrief = {
  intent: ConversationVisualIntent;
  reflectionSignals: ReflectionSignals;
  storyVariant?: TopicStoryVariantId;
  microMood?: MicroMoodId;
  reflectionTone?: ReflectionToneId;
  lockedIntent?: LockedPrimaryIntentId;
};

export type EmotionalSceneBlock = {
  tension: EmotionalTensionId;
  pacing: EmotionalPacingId;
  heroObjectLabel: string;
  cameraLabel: string;
  phrases: string[];
  characterRole: string;
  negativeExtras: string[];
};

const MEMORY_DENSITY: Record<'sparse' | 'balanced' | 'rich', string> = {
  sparse: 'visual memory density sparse calm negative space one clear story beat',
  balanced: 'visual memory density balanced two to three story objects readable at glance',
  rich: 'visual memory density rich layered props clear conversation trace high recognition',
};

const PORTRAIT_AVOID = [
  'centered portrait composition',
  'idle character facing camera',
  'AI wallpaper aesthetic',
  'generic cinematic portrait',
  'mascot framing',
  'static pose',
  'plush cute character',
  'empty emotional face',
];

export function resolveMemoryDensity(
  signals: ReflectionSignals,
  tension: EmotionalTensionId,
  pacing: EmotionalPacingId
): keyof typeof MEMORY_DENSITY {
  if (pacing === 'cinematic_tension' || pacing === 'active') return 'rich';
  if (tension === 'active_comparison' || tension === 'creative_production') return 'rich';
  if (signals.comparisonIntensity >= 0.45 || signals.detailFocus >= 0.55) return 'rich';
  if (pacing === 'sparse' || signals.calmnessLevel >= 0.68) return 'sparse';
  return 'balanced';
}

export function resolveCharacterRolePhrase(intent: ConversationVisualIntent): string {
  if (intent.characterMode === 'environment_first') {
    return 'human figure secondary small in frame maximum thirty five percent scale hero objects and environment carry memory';
  }
  if (intent.id === 'premium_vehicle_comparison' || intent.id === 'product_comparison') {
    return 'stylized human as decision-maker between hero objects under thirty five percent frame never poster subject alone';
  }
  return 'stylized human integrated mid-action under thirty five percent frame not model posing for portrait';
}

export function buildActionMemoryPhrase(
  intent: ConversationVisualIntent,
  tension: EmotionalTensionId
): string {
  const spec = getIntentCompositionSpec(intent.composition);
  return [
    'scene captures one remembered moment from today AI dialogue',
    spec.subjectAction,
    getTensionPhrase(tension),
    'not a chat screenshot not message bubbles not UI overlay',
  ].join(', ');
}

export function buildEmotionalSceneBlock(input: EmotionalSceneBrief): EmotionalSceneBlock {
  const { intent, reflectionSignals, storyVariant, reflectionTone } = input;
  const tension = resolveEmotionalTension(intent.id, reflectionSignals, storyVariant);
  const cinematic = buildCinematicDirectionBlock({
    intent,
    reflectionSignals,
    tension,
    storyVariant,
    reflectionTone,
    lockedIntent: input.lockedIntent,
  });
  const hero = resolveHeroObject(intent.id, intent.composition);
  const composition = getIntentCompositionSpec(intent.composition);
  const density =
    input.lockedIntent === 'premium_vehicle_comparison'
      ? 'rich'
      : resolveMemoryDensity(reflectionSignals, tension, cinematic.pacing);

  const phrases = [
    'premium editorial campaign key visual directed film still not AI wallpaper',
    '9:16 vertical composition left third clean for poster typography overlay',
    buildActionMemoryPhrase(intent, tension),
    hero.objectPhrase,
    ...hero.secondaryProps,
    ...buildDepthLayerPhrases(composition.depth),
    ...cinematic.phrases,
    MEMORY_DENSITY[density],
    resolveCharacterRolePhrase(intent),
    'behavioral memory visible through objects and action not through text',
    'premium stylized realism handcrafted editorial 3D cinematic',
  ];

  return {
    tension,
    pacing: cinematic.pacing,
    heroObjectLabel: hero.label,
    cameraLabel: cinematic.cameraLabel,
    phrases,
    characterRole: resolveCharacterRolePhrase(intent),
    negativeExtras: [
      ...PORTRAIT_AVOID,
      ...cinematic.negativeExtras,
      ...composition.avoidFlatPortrait,
      ...intent.negativeExtras.slice(0, 4),
    ],
  };
}

export function buildEmotionalScenePromptBlock(input: EmotionalSceneBrief): string {
  return buildEmotionalSceneBlock(input).phrases.join(', ');
}
