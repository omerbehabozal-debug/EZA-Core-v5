/**
 * Cinematic art direction — camera, pacing, focal hierarchy, eye flow (Sprint 11O).
 */

import type { ConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import type { ReflectionToneId } from '@/lib/eza/mirror/reflectionToneEngine';
import type { ReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import type { TopicStoryVariantId } from '@/lib/eza/mirror/reflectionSignals';
import type { EmotionalTensionId } from '@/lib/eza/mirror/intentCompositionSystem';
import { buildCameraGrammarPhrases, getCameraGrammar } from '@/lib/eza/mirror/cameraGrammarRegistry';
import {
  getPacingPhrase,
  resolveEmotionalPacing,
  type EmotionalPacingId,
} from '@/lib/eza/mirror/emotionalPacingEngine';
import {
  buildVisualConflictPhrases,
  resolveVisualConflictLevel,
} from '@/lib/eza/mirror/visualConflictSystem';

export type CinematicDirectionBrief = {
  intent: ConversationVisualIntent;
  reflectionSignals: ReflectionSignals;
  tension: EmotionalTensionId;
  storyVariant?: TopicStoryVariantId;
  reflectionTone?: ReflectionToneId;
};

export type CinematicDirectionBlock = {
  pacing: EmotionalPacingId;
  cameraLabel: string;
  phrases: string[];
  focalHierarchy: string;
  eyeFlow: string;
  blocking: string;
  atmosphere: string;
  negativeExtras: string[];
};

const FOCAL_HIERARCHY =
  'focal hierarchy primary hero objects sharp secondary human behavior under thirty five percent frame scale atmospheric environment support';

const CHARACTER_SCALE_RULE =
  'character never dominates more than thirty five percent of frame scale environmental storytelling leads';

const EYE_FLOW_BASE =
  'eye flow directed from hero object through character gesture toward light source then calm lower left typography safe zone';

const CINEMATIC_NEGATIVE = [
  'symmetrical portrait framing',
  'straight-on centered portrait',
  'wallpaper composition',
  'static idle pose',
  'subject staring at camera',
  'empty environment stock photo',
  'generic AI cinematic portrait',
  'posterized mascot framing',
  'flat single-plane composition',
  'AI mood wallpaper',
  'midjourney wallpaper aesthetic',
];

const TONE_ATMOSPHERE: Partial<Record<ReflectionToneId, string>> = {
  thoughtful:
    'atmosphere thoughtful generous negative space soft light transitions low movement editorial pause',
  calm_reflective:
    'atmosphere calm reflective slow pacing soft gradients contemplative stillness with inner momentum',
  emotionally_open:
    'atmosphere emotionally open warm environmental light close tactile detail human warmth',
  rebuilding:
    'atmosphere rebuilding sunrise transition tones forward movement renewal energy',
  focused_growth:
    'atmosphere focused growth clear directional light purposeful composition',
  curious_light:
    'atmosphere curious light open frames discovery energy gentle contrast',
  mentally_tired:
    'atmosphere mentally tired soft low-contrast restful environment not clinical',
  emotionally_cautious:
    'atmosphere emotionally cautious measured spacing protective calm',
  quietly_confident:
    'atmosphere quietly confident assured minimal drama refined light',
};

function resolveAtmosphere(
  tone: ReflectionToneId | undefined,
  pacing: EmotionalPacingId,
  intentId: string
): string {
  if (tone && TONE_ATMOSPHERE[tone]) return TONE_ATMOSPHERE[tone]!;
  if (pacing === 'cinematic_tension' || pacing === 'active') {
    return 'atmosphere comparison duality layered contrast active focal tension editorial film still';
  }
  if (pacing === 'sparse') {
    return 'atmosphere sparse cinematic breathing room lived-in quiet space';
  }
  return `atmosphere natural editorial pacing for ${intentId.replace(/_/g, ' ')}`;
}

function resolveBlocking(intent: ConversationVisualIntent, pacing: EmotionalPacingId): string {
  const verbs =
    pacing === 'cinematic_tension' || pacing === 'active'
      ? 'captured mid-decision comparing weighing orienting toward choice'
      : pacing === 'sparse'
        ? 'reflective pause examining preparing subtle motion not idle'
        : 'living the moment hands engaged environment not posing';
  return `cinematic blocking ${verbs} directed moment not model shoot`;
}

export function buildCinematicDirectionBlock(
  input: CinematicDirectionBrief
): CinematicDirectionBlock {
  const { intent, reflectionSignals, tension, storyVariant, reflectionTone } = input;
  const pacing = resolveEmotionalPacing(reflectionSignals, tension, storyVariant);
  const camera = getCameraGrammar(intent.composition);
  const conflictLevel = resolveVisualConflictLevel(
    intent.id,
    intent.composition,
    pacing
  );

  const phrases = [
    'directed cinematic artwork Netflix key visual Apple TV editorial film still',
    ...buildCameraGrammarPhrases(intent.composition),
    getPacingPhrase(pacing),
    ...buildVisualConflictPhrases(conflictLevel),
    FOCAL_HIERARCHY,
    CHARACTER_SCALE_RULE,
    resolveBlocking(intent, pacing),
    resolveAtmosphere(reflectionTone, pacing, intent.id),
    EYE_FLOW_BASE,
    'environmental storytelling lived-in atmosphere subtle motion believable space',
    'cinematic imperfection natural asymmetry not sterile AI render',
  ];

  return {
    pacing,
    cameraLabel: camera.lens,
    phrases,
    focalHierarchy: FOCAL_HIERARCHY,
    eyeFlow: EYE_FLOW_BASE,
    blocking: resolveBlocking(intent, pacing),
    atmosphere: resolveAtmosphere(reflectionTone, pacing, intent.id),
    negativeExtras: CINEMATIC_NEGATIVE,
  };
}

export function buildCinematicDirectionPromptBlock(
  input: CinematicDirectionBrief
): string {
  return buildCinematicDirectionBlock(input).phrases.join(', ');
}
