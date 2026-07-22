/**
 * Plus “Yeni Sahne” must re-roll the image, not re-direct the story.
 * When a D2/director mapped prompt is already on the card, reuse it.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const PINNED_PROMPT_SOURCES = new Set([
  'interpretation_v5_mapper',
  'director_v5_mapper',
]);

/** True when the card already carries a director/Interpretation mapped visual prompt. */
export function hasPinnedMappedMirrorPrompt(card: DailyMirrorCardModel | null | undefined): boolean {
  const prompt = card?.visual?.prompt?.trim() ?? '';
  if (!prompt.includes('VISUAL NARRATIVE:')) return false;
  const source = card?.mirrorDirectorMetadata?.promptSource?.trim() ?? '';
  if (source && PINNED_PROMPT_SOURCES.has(source)) return true;
  // Mapped V5 prompts start with the narrative block even if metadata was dropped.
  return prompt.startsWith('VISUAL NARRATIVE:');
}
