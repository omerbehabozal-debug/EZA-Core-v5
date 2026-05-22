/**
 * Structured OpenAI scene prompt blocks — Sprint 12A.
 * AI generates scene only; frontend owns layout/typography.
 */

import type { ConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import type { EmotionalSceneBlock } from '@/lib/eza/mirror/emotionalSceneEngine';
import type { ReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import { resolveHeroObject } from '@/lib/eza/mirror/heroObjectRegistry';
import {
  resolveEmotionalDensity,
  buildDensityPhrases,
} from '@/lib/eza/mirror/emotionalDensityMatrix';
import { buildCameraGrammarPhrases } from '@/lib/eza/mirror/cameraGrammarRegistry';
import { buildMirrorNegativePrompt } from '@/lib/eza/mirror/ezaVisualCanon';
import type { SceneTopicKey } from '@/lib/eza/mirror/visualPromptPresets';
import {
  buildIntentLockPromptBlock,
  getIntentLockForbiddenPhrases,
  type LockedPrimaryIntentId,
} from '@/lib/eza/mirror/intentLockSystem';

export const STYLE_BLOCK = [
  'premium cinematic editorial scene',
  'warm emotional realism',
  'high-end mobile poster background',
  'soft but confident contrast',
  'film still atmosphere',
  'not cartoon not game UI not dashboard not startup mascot not AI wallpaper',
].join(', ');

export const LIGHTING_BLOCK = [
  'cinematic natural light with warm key and soft fill',
  'atmospheric depth separation foreground midground background',
  'subtle lens falloff editorial campaign quality',
].join(', ');

export const DEFAULT_CAMERA_BLOCK = [
  '35mm cinematic lens',
  'shallow depth of field',
  'foreground midground background separation',
  'subject on right or center-right',
  'clean overlay safe space on left and top for typography',
  'editorial composition not centered portrait',
].join(', ');

export const SAFE_ZONE_BLOCK = [
  '9:16 vertical poster-ready scene',
  'left third and upper quarter kept low-detail for text overlay safe zones',
  'no text no typography no logos no UI no watermarks in image',
  'textless poster-ready background only',
].join(', ');

export const FIXED_NEGATIVE_SCENE = [
  'no UI',
  'no text',
  'no readable writing',
  'no watermark',
  'no logo',
  'no dashboard',
  'no phone screen',
  'no chat bubbles',
  'no meme',
  'no neon cyberpunk',
  'no game UI',
  'no low quality lighting',
  'no distorted face',
  'no extra fingers',
  'no centered empty portrait',
  'no AI wallpaper',
  'no static mascot pose',
  'no plush toy',
  'no sticker character',
  'no card layout',
].join(', ');

export type StructuredScenePromptInput = {
  topicKey: SceneTopicKey;
  intent: ConversationVisualIntent;
  emotionalBlock: EmotionalSceneBlock;
  reflectionSignals: ReflectionSignals;
  atmosphereLabel: string;
  emotionLabel: string;
  lockedIntent?: LockedPrimaryIntentId;
};

export function buildStructuredScenePrompt(input: StructuredScenePromptInput): {
  prompt: string;
  negativePrompt: string;
} {
  const hero = resolveHeroObject(input.intent.id, input.intent.composition);
  const density = resolveEmotionalDensity(
    input.intent.id,
    input.emotionalBlock.tension,
    input.reflectionSignals
  );
  const camera =
    input.intent.composition === 'comparison_scene'
      ? buildCameraGrammarPhrases('comparison_scene').join(', ')
      : input.intent.composition === 'restoration_scene'
        ? buildCameraGrammarPhrases('restoration_scene').join(', ')
        : input.intent.composition === 'travel_journey_scene'
          ? buildCameraGrammarPhrases('travel_journey_scene').join(', ')
          : input.intent.composition === 'wellness_scene'
            ? buildCameraGrammarPhrases('wellness_scene').join(', ')
            : DEFAULT_CAMERA_BLOCK;

  const intentBlock = [
    `scene intent: ${input.intent.label}`,
    input.intent.mizansen,
    `atmosphere: ${input.atmosphereLabel}`,
    `emotion mood: ${input.emotionLabel}`,
  ].join(', ');

  const heroBlock = [hero.objectPhrase, ...hero.secondaryProps].join(', ');

  const actionBlock = input.emotionalBlock.phrases
    .filter((p) => !p.startsWith('camera grammar'))
    .slice(0, 8)
    .join(', ');

  const compositionBlock = [
    ...buildDensityPhrases(density),
    input.emotionalBlock.characterRole,
    'character supports hero object never sole poster subject',
  ].join(', ');

  const intentLockBlock = buildIntentLockPromptBlock(input.lockedIntent ?? null);

  const prompt = [
    intentLockBlock ? `INTENT LOCK BLOCK: ${intentLockBlock}` : '',
    'HERO OBJECT BLOCK:',
    heroBlock,
    'COMPOSITION BLOCK:',
    compositionBlock,
    'ACTION MEMORY BLOCK:',
    actionBlock,
    'CINEMATIC DIRECTION BLOCK:',
    input.emotionalBlock.phrases.slice(0, 6).join(', '),
    'STYLE BLOCK:',
    STYLE_BLOCK,
    'LIGHTING BLOCK:',
    LIGHTING_BLOCK,
    'CAMERA BLOCK:',
    camera,
    'INTENT BLOCK:',
    intentBlock,
    'SAFE ZONE BLOCK:',
    SAFE_ZONE_BLOCK,
  ]
    .filter(Boolean)
    .join(' ');

  const negativePrompt = buildMirrorNegativePrompt(input.topicKey, [
    ...getIntentLockForbiddenPhrases(input.lockedIntent ?? null),
    ...input.intent.negativeExtras,
    ...input.emotionalBlock.negativeExtras,
    ...FIXED_NEGATIVE_SCENE.split(', '),
  ]);

  return { prompt, negativePrompt };
}
