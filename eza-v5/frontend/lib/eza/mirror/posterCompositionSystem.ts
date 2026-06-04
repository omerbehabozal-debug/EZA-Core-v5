/**
 * Daily Mirror poster — composition mathematics (Sprint 11L).
 * Zones, typography scale, scrim strength, intent-based density.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import type { ContextualHighlightKind } from '@/lib/eza/mirror/contextualHighlight';

import {
  POSTER_IDENTITY_HYBRID_ZONE_GRID_ROWS,
  POSTER_IDENTITY_ZONE_GRID_ROWS,
  POSTER_ZONE_GRID_ROWS,
} from '@/lib/eza/mirror/posterEditorialMathematics';

/** Card design width; export captures at 1080px (shareExport). */
export const POSTER_DESIGN_WIDTH_PX = 432;

export const POSTER_DESIGN_HEIGHT_PX = 768;

export const POSTER_EXPORT_WIDTH_PX = 1080;

export const POSTER_EXPORT_SCALE =
  POSTER_EXPORT_WIDTH_PX / POSTER_DESIGN_WIDTH_PX;

/** Perceived area budget (must sum to 1). */
export const POSTER_AREA_SCENE = 0.7;
export const POSTER_AREA_EDITORIAL = 0.2;
export const POSTER_AREA_SUPPORT = 0.1;

export type PosterLayoutDensity = 'calm' | 'comparison' | 'research' | 'balanced';

export type PosterCompositionProfile = {
  density: PosterLayoutDensity;
  /** CSS grid row template for content stack */
  gridRows: string;
  highlightEmphasis: 'whisper' | 'ribbon' | 'prominent';
  scrimStrength: 'light' | 'medium' | 'strong';
};

/** Design px → approximate px on 1080×1920 export PNG */
export function posterExportPx(designPx: number): number {
  return Math.round(designPx * POSTER_EXPORT_SCALE);
}

/** Typography at design width (432px card). */
export const POSTER_TYPE = {
  headline: { designPx: 34, exportPx: posterExportPx(34) },
  story: { designPx: 14, exportPx: posterExportPx(14) },
  quote: { designPx: 13, exportPx: posterExportPx(13) },
  highlightTitle: { designPx: 7, exportPx: posterExportPx(7) },
  highlightLabel: { designPx: 8, exportPx: posterExportPx(8) },
  metricLabel: { designPx: 8, exportPx: posterExportPx(8) },
  metricLine: { designPx: 10.5, exportPx: posterExportPx(10.5) },
  footer: { designPx: 7, exportPx: posterExportPx(7) },
  header: { designPx: 9, exportPx: posterExportPx(9) },
} as const;

/** Safe zone height fractions of card (9:16). */
export const POSTER_ZONES = {
  top: 0.06,
  titleEditorial: 0.16,
  sceneFlex: 0.58,
  bottomSupport: 0.2,
} as const;

function mapIntentFromLabel(label?: string): string | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (l.includes('car comparison') || l.includes('vehicle') || l.includes('product comparison')) {
    return 'comparison';
  }
  if (l.includes('restoration') || l.includes('heritage') || l.includes('research')) {
    return 'research';
  }
  if (l.includes('culinary') || l.includes('cooking') || l.includes('wellness') || l.includes('calm')) {
    return 'calm';
  }
  return null;
}

export function resolvePosterLayoutDensity(card: DailyMirrorCardModel): PosterLayoutDensity {
  const intentHint = mapIntentFromLabel(card.visual?.sceneIntentLabel);
  if (card.storyVariant === 'compare') return 'comparison';
  if (intentHint === 'comparison') return 'comparison';
  if (intentHint === 'research') return 'research';
  if (intentHint === 'calm' || card.storyTopicKey === 'health') return 'calm';
  return 'balanced';
}

export function highlightEmphasisFor(
  density: PosterLayoutDensity,
  kind: ContextualHighlightKind
): PosterCompositionProfile['highlightEmphasis'] {
  if (density === 'comparison' && kind === 'dual_comparison') return 'prominent';
  if (density === 'comparison') return 'ribbon';
  if (density === 'calm') return 'whisper';
  if (density === 'research' && kind === 'triple_tags') return 'ribbon';
  if (kind === 'dual_comparison') return 'ribbon';
  return 'whisper';
}

const DENSITY_PROFILES: Record<PosterLayoutDensity, Omit<PosterCompositionProfile, 'density'>> = {
  calm: {
    gridRows: POSTER_ZONE_GRID_ROWS,
    highlightEmphasis: 'whisper',
    scrimStrength: 'medium',
  },
  balanced: {
    gridRows: POSTER_ZONE_GRID_ROWS,
    highlightEmphasis: 'whisper',
    scrimStrength: 'medium',
  },
  research: {
    gridRows: POSTER_ZONE_GRID_ROWS,
    highlightEmphasis: 'ribbon',
    scrimStrength: 'medium',
  },
  comparison: {
    gridRows: POSTER_ZONE_GRID_ROWS,
    highlightEmphasis: 'prominent',
    scrimStrength: 'medium',
  },
};

export function getPosterComposition(
  card: DailyMirrorCardModel,
  layout: 'legacy_bleed' | 'identity_first' | 'identity_hybrid' = 'legacy_bleed'
): PosterCompositionProfile {
  const density = resolvePosterLayoutDensity(card);
  const base = DENSITY_PROFILES[density];
  const gridRows =
    layout === 'identity_first'
      ? POSTER_IDENTITY_ZONE_GRID_ROWS
      : layout === 'identity_hybrid'
        ? POSTER_IDENTITY_HYBRID_ZONE_GRID_ROWS
        : base.gridRows;
  return { density, ...base, gridRows };
}

export function buildPosterCompositionStyle(
  profile: PosterCompositionProfile
): Record<string, string> {
  return {
    ['--poster-grid-rows' as string]: profile.gridRows,
    ['--poster-zone-rows' as string]: profile.gridRows,
    ['--poster-scrim' as string]:
      profile.scrimStrength === 'strong'
        ? '0.88'
        : profile.scrimStrength === 'light'
          ? '0.68'
          : '0.78',
  };
}
