/**
 * P4-C5 Style Lens prompt injection — RETIRED.
 *
 * Character / mascot / “premium human” blocks were overriding D2 Interpretation
 * mapped prompts (panda / trench-coat portrait drift). Scene generation must
 * send the director/mapped prompt unchanged.
 */

import type { MirrorVisualPromptPayload } from '@/lib/eza/mirror/types';
import type { StyleLensId } from '@/lib/eza/mirror/styleLensRegistry';

/**
 * @deprecated No-op. Kept so call sites/tests compile; does not mutate prompt.
 */
export function applyStyleLensToVisual(
  visual: MirrorVisualPromptPayload,
  _lensId?: StyleLensId,
  _variationIndex?: number
): MirrorVisualPromptPayload {
  return visual;
}

/** Strip any legacy `style lens:` tail left on cached/heuristic prompts. */
export function stripLegacyStyleLensFromPrompt(prompt: string): string {
  if (!prompt || !/style lens:/i.test(prompt)) return prompt;
  return prompt
    .replace(/\s*style lens:[^.!\n]*(?:[.!])?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Seed-only variation for Plus “Yeni Sahne” — no creative instruction. */
export function withSceneVariationSeed(
  visual: MirrorVisualPromptPayload,
  variationIndex: number
): MirrorVisualPromptPayload {
  const cleanedPrompt = stripLegacyStyleLensFromPrompt(visual.prompt ?? '');
  const base = cleanedPrompt !== (visual.prompt ?? '') ? { ...visual, prompt: cleanedPrompt } : visual;
  if (variationIndex <= 0) return base;
  const suffix = `scene_var:${variationIndex}`;
  const seed = base.seedHint ?? 'mirror';
  if (seed.includes(suffix)) return base;
  const seedHint = `${seed}:${suffix}`;
  return {
    ...base,
    seedHint: seedHint.length > 256 ? seedHint.slice(0, 256) : seedHint,
  };
}
