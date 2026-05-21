/**
 * Editorial contrast & readability (Sprint 11M).
 * Gradient-first scrims — blur is accent only, never primary.
 */

import type { PosterLayoutDensity } from '@/lib/eza/mirror/posterCompositionSystem';

/** Design px at 432px card width (×2.5 ≈ export on 1080). */
export const EDITORIAL_TYPE = {
  headline: 34,
  story: 14,
  quote: 13,
  metricLabel: 8,
  metricLine: 10.5,
  footer: 7.5,
  highlightWhisper: 7,
} as const;

export type EditorialContrastProfile = {
  /** Scene punch — CSS filter on hero image */
  sceneBrightness: number;
  sceneContrast: number;
  sceneSaturate: number;
  /** Bottom fade strength 0–1 */
  bottomFade: number;
  /** Title zone warm scrim opacity peak */
  titleScrimPeak: number;
  storyOpacity: number;
  quoteOpacity: number;
  metricLineOpacity: number;
};

/** Calm = editorial restraint, not low contrast. */
const CONTRAST_BY_DENSITY: Record<PosterLayoutDensity, EditorialContrastProfile> = {
  calm: {
    sceneBrightness: 1.06,
    sceneContrast: 1.1,
    sceneSaturate: 1.06,
    bottomFade: 0.72,
    titleScrimPeak: 0.78,
    storyOpacity: 0.94,
    quoteOpacity: 0.86,
    metricLineOpacity: 0.82,
  },
  balanced: {
    sceneBrightness: 1.08,
    sceneContrast: 1.12,
    sceneSaturate: 1.08,
    bottomFade: 0.76,
    titleScrimPeak: 0.82,
    storyOpacity: 0.96,
    quoteOpacity: 0.88,
    metricLineOpacity: 0.84,
  },
  research: {
    sceneBrightness: 1.07,
    sceneContrast: 1.14,
    sceneSaturate: 1.07,
    bottomFade: 0.74,
    titleScrimPeak: 0.8,
    storyOpacity: 0.95,
    quoteOpacity: 0.87,
    metricLineOpacity: 0.83,
  },
  comparison: {
    sceneBrightness: 1.09,
    sceneContrast: 1.14,
    sceneSaturate: 1.09,
    bottomFade: 0.78,
    titleScrimPeak: 0.84,
    storyOpacity: 0.96,
    quoteOpacity: 0.88,
    metricLineOpacity: 0.85,
  },
};

export function getEditorialContrast(
  density: PosterLayoutDensity
): EditorialContrastProfile {
  return CONTRAST_BY_DENSITY[density];
}

/** Layered poster headline shadow — readable on busy scenes */
export const HEADLINE_TEXT_SHADOW =
  '0 1px 2px rgba(0,0,0,0.9), 0 4px 24px rgba(0,0,0,0.75), 0 0 40px rgba(10,6,20,0.55)';

export const STORY_TEXT_SHADOW =
  '0 1px 8px rgba(0,0,0,0.85), 0 2px 16px rgba(10,6,20,0.5)';

export const QUOTE_TEXT_SHADOW = '0 1px 12px rgba(0,0,0,0.7)';

export const METRIC_TEXT_SHADOW = '0 1px 6px rgba(0,0,0,0.65)';

export function buildEditorialReadabilityVars(
  profile: EditorialContrastProfile
): Record<string, string> {
  return {
    ['--poster-title-scrim' as string]: String(profile.titleScrimPeak),
    ['--poster-bottom-fade' as string]: String(profile.bottomFade),
    ['--poster-story-opacity' as string]: String(profile.storyOpacity),
    ['--poster-quote-opacity' as string]: String(profile.quoteOpacity),
    ['--poster-metric-opacity' as string]: String(profile.metricLineOpacity),
    ['--poster-scene-brightness' as string]: String(profile.sceneBrightness),
    ['--poster-scene-contrast' as string]: String(profile.sceneContrast),
    ['--poster-scene-saturate' as string]: String(profile.sceneSaturate),
  };
}
