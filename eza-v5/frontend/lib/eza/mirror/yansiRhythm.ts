/**
 * Local Yansı experience presentation pacing.
 * Does not affect LLM, streaming, network, or generation.
 */

export const YANSI_RHYTHM_STORAGE_KEY = 'bilign:yansi-rhythm';

export const YANSI_RHYTHM_IDS = ['calm', 'normal', 'fast'] as const;
export type YansiRhythmId = (typeof YANSI_RHYTHM_IDS)[number];

export const YANSI_RHYTHM_LABELS: Record<YansiRhythmId, string> = {
  calm: 'Sakin',
  normal: 'Normal',
  fast: 'Hızlı',
};

export const YANSI_RHYTHM_DEFAULT: YansiRhythmId = 'normal';

export type YansiRevealPace = {
  charsPerTick: number;
  tickMs: number;
  scrollBehavior: ScrollBehavior;
};

export const YANSI_RHYTHM_REVEAL: Record<YansiRhythmId, YansiRevealPace> = {
  calm: { charsPerTick: 2, tickMs: 28, scrollBehavior: 'smooth' },
  normal: { charsPerTick: 4, tickMs: 16, scrollBehavior: 'smooth' },
  fast: { charsPerTick: 12, tickMs: 10, scrollBehavior: 'auto' },
};

export function isYansiRhythmId(value: unknown): value is YansiRhythmId {
  return value === 'calm' || value === 'normal' || value === 'fast';
}

export function normalizeYansiRhythm(value: unknown): YansiRhythmId {
  return isYansiRhythmId(value) ? value : YANSI_RHYTHM_DEFAULT;
}

export function readYansiRhythm(): YansiRhythmId {
  if (typeof window === 'undefined') return YANSI_RHYTHM_DEFAULT;
  try {
    return normalizeYansiRhythm(window.localStorage.getItem(YANSI_RHYTHM_STORAGE_KEY));
  } catch {
    return YANSI_RHYTHM_DEFAULT;
  }
}

export function writeYansiRhythm(value: YansiRhythmId): void {
  if (typeof window === 'undefined') return;
  const next = normalizeYansiRhythm(value);
  try {
    window.localStorage.setItem(YANSI_RHYTHM_STORAGE_KEY, next);
  } catch {
    /* quota */
  }
}

export function resolveYansiRevealPace(
  rhythm: YansiRhythmId,
  reducedMotion: boolean
): YansiRevealPace {
  if (reducedMotion) {
    return { charsPerTick: 10_000, tickMs: 0, scrollBehavior: 'auto' };
  }
  return YANSI_RHYTHM_REVEAL[normalizeYansiRhythm(rhythm)];
}
