/**
 * P4-C5 — apply Style Lens to visual prompt at scene-generation time (immutable card visual).
 */

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import {
  DEFAULT_STYLE_LENS_ID,
  getStyleLens,
  type StyleLensId,
} from '@/lib/eza/mirror/styleLensRegistry';

const LITERAL_MASCOT_AVOID_SNIPPET =
  'do not depict a panda, fox, animal doctor mascot, cartoon animal, or literal character costume';

const MASCOT_AVOID_FRAGMENTS: Partial<Record<StyleLensId, RegExp[]>> = {
  curious_panda: [
    /do not depict a panda,? fox,? animal doctor mascot,? cartoon animal,? or literal character costume/gi,
    /not a panda[^,]*/gi,
    /not a literal explorer mascot/gi,
    /not a fox guide character/gi,
    /no plush toy,? no children book character,? no sticker mascot/gi,
  ],
  explorer_fox: [
    /do not depict a panda,? fox,? animal doctor mascot,? cartoon animal,? or literal character costume/gi,
    /not a fox guide character/gi,
    /not a literal explorer mascot/gi,
    /no plush toy,? no children book character,? no sticker mascot/gi,
  ],
  wise_owl: [
    /do not depict a panda,? fox,? animal doctor mascot,? cartoon animal,? or literal character costume/gi,
    /not a fox guide character/gi,
    /no plush toy,? no children book character,? no sticker mascot/gi,
  ],
};

function stripMascotAvoidForLens(prompt: string, lensId: StyleLensId): string {
  const patterns = MASCOT_AVOID_FRAGMENTS[lensId];
  if (!patterns?.length) return prompt;
  let out = prompt;
  for (const re of patterns) {
    out = out.replace(re, ' ');
  }
  return out.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();
}

function appendUniqueNegative(base: string, addition: string): string {
  const parts = base
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const addParts = addition
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set(parts.map((p) => p.toLowerCase()));
  for (const p of addParts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      parts.push(p);
      seen.add(key);
    }
  }
  return parts.join(', ');
}

function extendSeedHint(seedHint: string, lensId: StyleLensId, variationIndex: number): string {
  const suffix = `lens:${lensId}:v${variationIndex}`;
  if (seedHint.includes(suffix)) return seedHint;
  const combined = `${seedHint}:${suffix}`;
  return combined.length > 256 ? combined.slice(0, 256) : combined;
}

/**
 * Returns a shallow copy of visual with style lens applied for OpenAI scene generation.
 */
export function applyStyleLensToVisual(
  visual: MirrorVisualPromptPayload,
  lensId: StyleLensId = DEFAULT_STYLE_LENS_ID,
  variationIndex = 0
): MirrorVisualPromptPayload {
  const lens = getStyleLens(lensId);
  let prompt = visual.prompt ?? '';

  if (lensId !== DEFAULT_STYLE_LENS_ID && prompt.includes(LITERAL_MASCOT_AVOID_SNIPPET)) {
    prompt = stripMascotAvoidForLens(prompt, lensId);
  }

  const styleBlock = lens.promptBlock.trim();
  const promptWithLens = prompt.includes('style lens:')
    ? prompt.replace(/style lens:[^,]+(?:,[^,]+)*/i, styleBlock)
    : `${prompt.trim()} ${styleBlock}`.trim();

  const negativePrompt = lens.negativeAdditions
    ? appendUniqueNegative(visual.negativePrompt ?? '', lens.negativeAdditions)
    : visual.negativePrompt ?? '';

  const qualityHints = [
    ...(visual.qualityHints ?? []),
    `style lens: ${lens.id}`,
    `style lens variation: ${variationIndex}`,
  ].slice(0, 18);

  return {
    ...visual,
    prompt: promptWithLens,
    negativePrompt,
    seedHint: extendSeedHint(visual.seedHint ?? '', lensId, variationIndex),
    qualityHints,
  };
}
