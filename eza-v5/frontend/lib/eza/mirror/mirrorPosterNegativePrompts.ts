/**
 * Negative prompt sets — Sprint 13C.
 * Scene-only vs hybrid middle poster modes.
 */

/** Mode A — textless scene background (existing 13B contract). */
export const SCENE_ONLY_NEGATIVE = [
  'no text',
  'no writing',
  'no readable writing',
  'no labels',
  'no logo',
  'no UI',
  'no watermark',
  'no typography in image',
  'no letters',
  'no numbers on screen',
] as const;

/** Mode B — embedded editorial copy allowed; brand/data zones forbidden. */
export const HYBRID_POSTER_NEGATIVE = [
  'no logo',
  'no watermark',
  'no date',
  'no brand mark',
  'no EZA logo',
  'no footer',
  'no hashtag',
  'no website URL',
  'no eza.ai',
  'no SEN AI DENGE cards',
  'no insight cards',
  'no progress bars',
  'no app UI',
  'no buttons',
  'no social media UI',
  'no dashboard',
  'no chat bubbles',
  'no phone screen',
  'no extra invented text beyond provided Turkish copy',
] as const;

export function buildSceneOnlyNegativeExtras(extras: string[] = []): string[] {
  return [...SCENE_ONLY_NEGATIVE, ...extras];
}

export function buildHybridPosterNegativePrompt(extras: string[] = []): string {
  const merged = [...HYBRID_POSTER_NEGATIVE, ...extras];
  return Array.from(new Set(merged.map((s) => s.trim()).filter(Boolean))).join(', ');
}

export function hybridNegativeIncludesNoText(): boolean {
  return HYBRID_POSTER_NEGATIVE.some((p) => p.toLowerCase().includes('no text'));
}
