/**
 * V5 — Layer B: minimal OpenAI image prompt from MirrorRenderBrief only.
 */

import type {
  MirrorLightMode,
  MirrorRenderBrief,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { MIRROR_V5_MAX_RENDER_PROMPT_CHARS } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';

const STYLE_BY_LIGHT_MODE: Record<MirrorLightMode, string> = {
  premium_editorial_daylight: [
    'Premium editorial photography.',
    'Natural daylight.',
    'Magazine cover quality.',
    'Elegant composition.',
    'Quiet luxury aesthetic.',
    'Open visual space.',
    'Emotion through light rather than darkness.',
    'Photographic realism.',
  ].join(' '),
  golden_hour_travel: [
    'Quiet luxury travel editorial.',
    'National Geographic premium cover quality.',
    'Monocle magazine aesthetic.',
    'Golden hour or fresh morning light.',
    'Open visual space.',
    'Photographic realism.',
  ].join(' '),
  soft_architectural_daylight: [
    'Architectural Digest editorial photography.',
    'Soft daylight.',
    'Refined materials.',
    'Precise composition.',
    'Open space.',
    'Photographic realism.',
  ].join(' '),
  clean_health_daylight: [
    'Clean natural light.',
    'Calm premium health editorial.',
    'Soft skin tones.',
    'Fresh air, clarity, care.',
    'No fear-based medical poster.',
    'Photographic realism.',
  ].join(' '),
  modern_technology_light: [
    'Modern bright workspace.',
    'Editorial technology photography.',
    'Clean reflections.',
    'Human-centered, no robot clichés.',
    'Photographic realism.',
  ].join(' '),
  golden_hour_road: [
    'Golden hour road editorial.',
    'Premium automotive lifestyle.',
    'Elegant motion, no commercial showroom.',
    'Photographic realism.',
  ].join(' '),
  contemplative_morning: [
    'Morning light or warm sunset.',
    'Quiet contemplative editorial.',
    'Soft atmosphere.',
    'Respectful and serene.',
    'Photographic realism.',
  ].join(' '),
  quiet_luxury_evening: [
    'Quiet luxury evening editorial.',
    'Warm lantern or soft twilight — not horror darkness.',
    'Elegant composition.',
    'Open visual space.',
    'Photographic realism.',
  ].join(' '),
};

const NORMAL_SAFETY =
  'No dashboard UI, scores, bullet lists, labels, infographics, or conversation summaries.';

const HEALTH_SAFETY = [
  'Premium health editorial only.',
  'Calm, dignified, informative curiosity — never alarming.',
  'No clinical diagnosis, treatment claims, before/after, or graphic medical imagery.',
  'No dashboard UI, scores, bullet lists, or summaries.',
].join(' ');

export const MIRROR_V5_NEGATIVE_PROMPT = [
  'collage',
  'inset',
  'moodboard',
  'dashboard',
  'infographic',
  'stock tourist',
  'motivational poster',
  'oversaturated HDR',
  'fake lens flare',
  '3D render',
  'robot face',
  'neon cyberpunk',
  'watermark',
  'conversation summary',
].join(', ');

export function buildMinimalOpenAIRenderPrompt(brief: MirrorRenderBrief): string {
  const style = STYLE_BY_LIGHT_MODE[brief.lightMode];
  const safety = brief.safetyMode === 'abstract_safe' ? HEALTH_SAFETY : NORMAL_SAFETY;

  const blocks = [
    'Create a premium editorial SAINA Mirror poster.',
    '',
    'This is not a summary, not an infographic, not a dashboard, not an advertisement.',
    'The card should create curiosity and make the viewer want to open the Mirror.',
    '',
    `TITLE:\n"${brief.title}"`,
    '',
    `TOPIC HINT:\n${brief.publicTopicHint}`,
    '',
    `CATEGORY:\n${brief.topicCategory}`,
  ];

  if (brief.mood) {
    blocks.push('', `MOOD:\n${brief.mood}`);
  }

  blocks.push(
    '',
    `VISUAL DIRECTION:\n${brief.visualDirection}`,
    '',
    `STYLE:\n${style}`,
    '',
    'Create one powerful, memorable visual interpretation.',
    'Use minimum text.',
    'The title may appear if it improves the poster.',
    'Do not explain the topic.',
    'Do not add summaries, labels, bullet points, charts, UI, badges or panels.',
    '',
    'Let OpenAI choose the composition, lighting, perspective, depth, typography and atmosphere.',
    '',
    'Format:',
    'Vertical 4:5.',
    'Photographic realism.',
    'Premium magazine cover quality.',
    'Elegant negative space.',
    'Shareable wow effect.',
    '',
    `Safety mode:\n${safety}`
  );

  let prompt = blocks.join('\n');
  if (prompt.length > MIRROR_V5_MAX_RENDER_PROMPT_CHARS) {
    prompt = prompt.slice(0, MIRROR_V5_MAX_RENDER_PROMPT_CHARS).trimEnd();
  }
  return prompt;
}

export function buildOpenAIRenderPromptFromPayload(
  brief: MirrorRenderBrief
): { prompt: string; promptLength: number; withinLimit: boolean } {
  const prompt = buildMinimalOpenAIRenderPrompt(brief);
  return {
    prompt,
    promptLength: prompt.length,
    withinLimit: prompt.length <= MIRROR_V5_MAX_RENDER_PROMPT_CHARS,
  };
}
