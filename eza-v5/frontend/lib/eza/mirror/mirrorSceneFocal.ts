/**
 * Optional normalized focal point for Mirror scene crops (0–1).
 * Absent / invalid metadata → safe center. Never invent persisted fake points.
 */

export type MirrorSceneFocalPoint = {
  focalX: number;
  focalY: number;
};

/** Safe central default when focal metadata is missing. */
export const MIRROR_DEFAULT_FOCAL: MirrorSceneFocalPoint = {
  focalX: 0.5,
  focalY: 0.5,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** Resolve optional focal; missing fields fall back to center (backward compatible). */
export function resolveMirrorSceneFocal(
  input?: Partial<MirrorSceneFocalPoint> | null
): MirrorSceneFocalPoint {
  if (!input || typeof input !== 'object') {
    return { ...MIRROR_DEFAULT_FOCAL };
  }
  const x = input.focalX;
  const y = input.focalY;
  return {
    focalX: typeof x === 'number' ? clamp01(x) : MIRROR_DEFAULT_FOCAL.focalX,
    focalY: typeof y === 'number' ? clamp01(y) : MIRROR_DEFAULT_FOCAL.focalY,
  };
}

/** CSS object-position / background-position from normalized focal (percent). */
export function mirrorFocalToCssPosition(focal?: Partial<MirrorSceneFocalPoint> | null): string {
  const { focalX, focalY } = resolveMirrorSceneFocal(focal);
  return `${(focalX * 100).toFixed(2)}% ${(focalY * 100).toFixed(2)}%`;
}

/** Inline style vars for cover crops (img + CSS background layers). */
export function mirrorFocalCssVars(
  focal?: Partial<MirrorSceneFocalPoint> | null
): { ['--mirror-focal-position']: string } {
  return {
    ['--mirror-focal-position']: mirrorFocalToCssPosition(focal),
  };
}
