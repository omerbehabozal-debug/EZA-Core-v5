/**
 * Sprint 12C — Poster palette contracts (premium vehicle vs default scrim).
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { POSTER_COLORS } from '@/lib/eza/mirror/posterEditorialMathematics';

export type PosterPaletteId = 'default_dark_scrim' | 'premium_light_editorial';

export const POSTER_PALETTE_PREMIUM = {
  baseTop: '#F8F6F1',
  baseBottom: '#F3F1EC',
  ink: '#172033',
  accent: '#7B61FF',
  accentSoft: '#9B84FF',
  warmOverlay: 'rgba(248,246,241,0.72)',
  glassLight: 'rgba(255,255,255,0.68)',
  sceneScrimTop: 'rgba(248,246,241,0.55)',
  sceneScrimBottom: 'rgba(243,241,236,0.65)',
  titleScrim: 'rgba(255,255,255,0.68)',
  quoteScrim: 'rgba(255,255,255,0.62)',
  highlightBorder: 'rgba(123,97,255,0.28)',
  insightBorder: 'rgba(123,97,255,0.12)',
  accentGlow: 'rgba(123, 97, 255, 0.14)',
} as const;

export function resolvePosterPalette(card: DailyMirrorCardModel): PosterPaletteId {
  if (card.visual?.lockedPrimaryIntent === 'premium_vehicle_comparison') {
    return 'premium_light_editorial';
  }
  const label = (card.visual?.sceneIntentLabel ?? '').toLowerCase();
  if (label.includes('car comparison') || label.includes('premium vehicle')) {
    return 'premium_light_editorial';
  }
  return 'default_dark_scrim';
}

export function buildPremiumPosterCssVars(): Record<string, string> {
  return {
    ['--poster-ink' as string]: POSTER_PALETTE_PREMIUM.ink,
    ['--poster-accent' as string]: POSTER_PALETTE_PREMIUM.accent,
    ['--poster-accent-glow' as string]: POSTER_PALETTE_PREMIUM.accentGlow,
    ['--poster-warm-overlay' as string]: POSTER_PALETTE_PREMIUM.warmOverlay,
    ['--poster-glass-light' as string]: POSTER_PALETTE_PREMIUM.glassLight,
  };
}

export function premiumPosterRootStyle(): Record<string, string> {
  return {
    background: `linear-gradient(180deg, ${POSTER_PALETTE_PREMIUM.baseTop} 0%, ${POSTER_PALETTE_PREMIUM.baseBottom} 100%)`,
  };
}

/** Re-export for skin class builders */
export { POSTER_COLORS };
