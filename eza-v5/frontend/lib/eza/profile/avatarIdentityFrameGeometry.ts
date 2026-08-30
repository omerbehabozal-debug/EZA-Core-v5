/**
 * Deterministic overlapping double-polygon avatar frame geometry.
 * Presentation-only — 16 vertices per contour, subtle radius variation.
 */

const VERTEX_COUNT = 16;

/** Polygon A — primary trace (~±1.75% radius variation, alternating facets). */
const RADIUS_PROFILE_A = [
  1.0, 0.983, 1.017, 0.988, 1.014, 0.982, 1.008, 0.991, 1.016, 0.985, 1.006, 0.98, 1.012,
  0.987, 1.018, 0.984,
] as const;

/**
 * Polygon B — secondary weave trace.
 * Phase-offset profile so A/B alternate inner/outer around the contour.
 */
const RADIUS_PROFILE_B = [
  1.015, 0.99, 1.002, 1.012, 0.978, 1.02, 0.993, 1.01, 0.984, 1.016, 0.997, 1.014, 0.976,
  1.022, 0.992, 1.008,
] as const;

export const AVATAR_IDENTITY_POLYGON_VERTEX_COUNT = VERTEX_COUNT;

export const AVATAR_IDENTITY_POLYGON_A = {
  rotationDeg: -1.75,
  scale: 1.0,
  opacity: 0.82,
} as const;

export const AVATAR_IDENTITY_POLYGON_B = {
  rotationDeg: 1.75,
  scale: 1.021,
  opacity: 0.48,
} as const;

function buildPolygonPoints(
  radiusProfile: readonly number[],
  baseRadius: number,
  rotationDeg: number,
  scale: number
): string {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const startAngle = -Math.PI / 2;
  return radiusProfile
    .map((factor, index) => {
      const theta = startAngle + rotationRad + (index / VERTEX_COUNT) * 2 * Math.PI;
      const radius = baseRadius * factor * scale;
      const x = 50 + radius * Math.cos(theta);
      const y = 50 + radius * Math.sin(theta);
      return `${x.toFixed(3)},${y.toFixed(3)}`;
    })
    .join(' ');
}

function radiusAtAngle(
  radiusProfile: readonly number[],
  baseRadius: number,
  rotationDeg: number,
  scale: number,
  angleRad: number
): number {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const startAngle = -Math.PI / 2 + rotationRad;
  const normalized = ((angleRad - startAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const segment = (normalized / (2 * Math.PI)) * VERTEX_COUNT;
  const index = Math.floor(segment) % VERTEX_COUNT;
  const next = (index + 1) % VERTEX_COUNT;
  const t = segment - index;
  const factor =
    radiusProfile[index]! * (1 - t) + radiusProfile[next]! * t;
  return baseRadius * factor * scale;
}

/** Approximate weave crossings where A/B alternate outer position (for tuning/report). */
export function countAvatarIdentityPolygonCrossingRegions(samples = 360): number {
  const baseRadius = 48;
  let crossings = 0;
  let prevSign = 0;
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * 2 * Math.PI;
    const rA = radiusAtAngle(
      RADIUS_PROFILE_A,
      baseRadius,
      AVATAR_IDENTITY_POLYGON_A.rotationDeg,
      AVATAR_IDENTITY_POLYGON_A.scale,
      angle
    );
    const rB = radiusAtAngle(
      RADIUS_PROFILE_B,
      baseRadius,
      AVATAR_IDENTITY_POLYGON_B.rotationDeg,
      AVATAR_IDENTITY_POLYGON_B.scale,
      angle
    );
    const sign = Math.sign(rA - rB);
    if (sign !== 0 && prevSign !== 0 && sign !== prevSign) crossings += 1;
    if (sign !== 0) prevSign = sign;
  }
  return crossings;
}

/** viewBox 0 0 100 100 — radius 48 ≈ 96px envelope when scaled to frame width. */
const BASE_RADIUS = 48;

export const AVATAR_IDENTITY_POLYGON_A_POINTS = buildPolygonPoints(
  RADIUS_PROFILE_A,
  BASE_RADIUS,
  AVATAR_IDENTITY_POLYGON_A.rotationDeg,
  AVATAR_IDENTITY_POLYGON_A.scale
);

export const AVATAR_IDENTITY_POLYGON_B_POINTS = buildPolygonPoints(
  RADIUS_PROFILE_B,
  BASE_RADIUS,
  AVATAR_IDENTITY_POLYGON_B.rotationDeg,
  AVATAR_IDENTITY_POLYGON_B.scale
);
