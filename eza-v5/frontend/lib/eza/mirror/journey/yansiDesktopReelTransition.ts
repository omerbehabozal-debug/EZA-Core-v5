/**
 * Desktop Reel vertical travel — one intentional gesture, two whole Yansı surfaces.
 * Chat must not enable this. Identity commits only after travel completes.
 */

export type YansiReelTravelDirection = 'up' | 'down';

export const YANSI_REEL_TRAVEL_MS = 560;
export const YANSI_REEL_REDUCED_MS = 180;
export const YANSI_REEL_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function yansiReelTravelDuration(reducedMotion: boolean): number {
  return reducedMotion ? YANSI_REEL_REDUCED_MS : YANSI_REEL_TRAVEL_MS;
}

export function yansiReelSurfaceTransform(
  role: 'current' | 'outgoing' | 'incoming',
  direction: YansiReelTravelDirection | null,
  traveling: boolean,
  reducedMotion: boolean
): string {
  if (reducedMotion || !direction || role === 'current') return 'translateY(0)';
  if (direction === 'down') {
    if (role === 'outgoing') return traveling ? 'translateY(-100%)' : 'translateY(0)';
    return traveling ? 'translateY(0)' : 'translateY(100%)';
  }
  if (role === 'outgoing') return traveling ? 'translateY(100%)' : 'translateY(0)';
  return traveling ? 'translateY(0)' : 'translateY(-100%)';
}

export function yansiReelSurfaceOpacity(
  role: 'current' | 'outgoing' | 'incoming',
  traveling: boolean,
  reducedMotion: boolean
): number {
  if (role === 'current') return 1;
  if (reducedMotion) {
    if (role === 'outgoing') return traveling ? 0 : 1;
    return traveling ? 1 : 0.4;
  }
  if (role === 'outgoing') return traveling ? 0.92 : 1;
  return traveling ? 1 : 0.96;
}

export function readYansiReelPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
