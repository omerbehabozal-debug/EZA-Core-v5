/**
 * Deterministic overlapping double-polygon avatar frame geometry.
 * Presentation-only — 16 vertices per contour, subtle radius variation.
 */

const VERTEX_COUNT = 16;

/** Polygon A — primary trace (~±1% radius variation). */
const RADIUS_PROFILE_A = [
  1.0, 0.992, 1.006, 0.997, 1.01, 0.991, 1.004, 0.996, 1.008, 0.993, 1.003, 0.989,
  1.007, 0.995, 1.009, 0.994,
] as const;

/** Polygon B — secondary trace (different profile for weave/cross). */
const RADIUS_PROFILE_B = [
  1.012, 0.995, 1.001, 1.008, 0.988, 1.014, 0.997, 1.005, 0.99, 1.011, 0.996, 1.009,
  0.987, 1.013, 0.999, 1.006,
] as const;

export const AVATAR_IDENTITY_POLYGON_VERTEX_COUNT = VERTEX_COUNT;

export const AVATAR_IDENTITY_POLYGON_A = {
  rotationDeg: -1,
  scale: 1.0,
  opacity: 0.85,
} as const;

export const AVATAR_IDENTITY_POLYGON_B = {
  rotationDeg: 1,
  scale: 1.015,
  opacity: 0.52,
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
