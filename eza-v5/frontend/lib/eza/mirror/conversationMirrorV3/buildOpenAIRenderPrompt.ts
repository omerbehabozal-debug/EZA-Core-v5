/**
 * SAINA Mirror Philosophy
 *
 * A Mirror is not a conversation summary.
 * A Mirror is not an insight report.
 * A Mirror is not an AI answer.
 *
 * A Mirror is a cinematic curiosity artifact.
 *
 * The card creates curiosity.
 * The landing provides context.
 * The conversation delivers knowledge.
 *
 * Never move contextual information back onto the card.
 *
 * Stage 0 image prompt: title + category + optional mood + minimal render brief.
 * Curiosity Seed Intelligence fields never enter this file's output.
 */

import type {
  MirrorLightMode,
  MirrorRenderBrief,
} from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { MIRROR_V5_MAX_RENDER_PROMPT_CHARS } from '@/lib/eza/mirror/conversationMirrorV3/mirrorRenderBriefTypes';
import { MIRROR_STAGE0_INCLUDE_MOOD_IN_IMAGE_PROMPT } from '@/lib/eza/mirror-network/philosophy';

const LIGHT_MODE_STYLE_LINE: Record<MirrorLightMode, string> = {
  premium_editorial_daylight: 'Premium editorial daylight, magazine cover quality, quiet luxury.',
  golden_hour_travel: 'Golden-hour travel editorial, open space, photographic realism.',
  soft_architectural_daylight: 'Soft architectural daylight, refined materials, open composition.',
  clean_health_daylight: 'Clean calm health editorial, natural light, dignified — never alarming.',
  modern_technology_light: 'Bright human-centered technology editorial, no robot clichés.',
  golden_hour_road: 'Golden-hour road editorial, elegant motion, lifestyle not showroom.',
  contemplative_morning: 'Morning or warm sunset, quiet contemplative editorial.',
  quiet_luxury_evening: 'Quiet luxury evening, warm twilight — not horror darkness.',
};

const STAGE0_SAFETY =
  'No dashboard, scores, bullet lists, summaries, labels, infographics, or conversation text.';

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
  'theme list',
  'subtitle paragraph',
].join(', ');

export function buildMinimalOpenAIRenderPrompt(brief: MirrorRenderBrief): string {
  const styleLine = LIGHT_MODE_STYLE_LINE[brief.lightMode];

  const blocks = [
    'Create a premium editorial SAINA Mirror poster.',
    'Curiosity poster — evoke wonder; do not explain the topic.',
    STAGE0_SAFETY,
    '',
    `TITLE:\n"${brief.title}"`,
    '',
    `CATEGORY:\n${brief.topicCategory}`,
  ];

  if (brief.mood && MIRROR_STAGE0_INCLUDE_MOOD_IN_IMAGE_PROMPT) {
    blocks.push('', `MOOD:\n${brief.mood}`);
  }

  blocks.push(
    '',
    `RENDER BRIEF:\n${styleLine}`,
    '',
    'Vertical 4:5. Photographic realism. Elegant negative space.',
    'Title may appear if it strengthens the poster. No body copy or theme lists.',
    brief.safetyMode === 'abstract_safe'
      ? 'Sensitive health topic — abstract, calm, never clinical or alarming.'
      : ''
  );

  let prompt = blocks.filter(Boolean).join('\n');
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
