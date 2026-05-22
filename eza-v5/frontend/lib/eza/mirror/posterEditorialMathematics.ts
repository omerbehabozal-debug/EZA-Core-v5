/**
 * Premium editorial card mathematics — Sprint 12A.
 * Preview 432×768 · export 1080×1920 · 2.5× scale.
 */

export const POSTER_SCALE = 2.5;

export const POSTER_PREVIEW_WIDTH_PX = 432;
export const POSTER_PREVIEW_HEIGHT_PX = 768;

export const POSTER_EXPORT_WIDTH_PX = 1080;
export const POSTER_EXPORT_HEIGHT_PX = 1920;

export const POSTER_ASPECT = '9 / 16' as const;

/** Export safe area (px @ 1080×1920) */
export const SAFE_EXPORT = {
  top: 110,
  bottom: 140,
  left: 56,
  right: 56,
} as const;

/** Preview safe area (÷ 2.5) */
/** Preview safe inset (px); ×2.5 ≈ export safe area */
export const SAFE_PREVIEW = {
  top: 44,
  bottom: 56,
  left: 22,
  right: 22,
} as const;

/** 12-column editorial grid */
export const GRID_PREVIEW = {
  container: POSTER_PREVIEW_WIDTH_PX,
  outerPadding: 24,
  contentWidth: 384,
  columnGap: 8,
  columns: 12,
} as const;

export const GRID_EXPORT = {
  container: POSTER_EXPORT_WIDTH_PX,
  outerPadding: 60,
  contentWidth: 960,
  columnGap: 20,
  columns: 12,
} as const;

/** Perceived vertical zones (% of card) */
export const POSTER_ZONE_PERCENT = {
  header: 9,
  titleStory: 20,
  scene: 42,
  quoteHighlight: 14,
  insights: 16,
  footer: 6,
} as const;

/** CSS grid rows for content stack */
export const POSTER_ZONE_GRID_ROWS =
  '9% 20% minmax(38%,1fr) 14% 16% 6%';

export const POSTER_COLORS = {
  ink: '#172033',
  whiteInk: '#FFFFFF',
  accentViolet: '#7B61FF',
  accentVioletSoft: '#9B84FF',
  secondaryText: '#667085',
  successSage: '#7E9E8E',
  warmSand: '#EADCCB',
  baseTop: '#F8F6F1',
  baseBottom: '#F3F1EC',
  darkScrim: 'rgba(14,6,22,0.55)',
  glassLight: 'rgba(255,255,255,0.22)',
  glassDark: 'rgba(18,8,28,0.4)',
} as const;

export const POSTER_RADIUS_PREVIEW = {
  card: 26,
  miniCard: 18,
  quote: 20,
} as const;

export const POSTER_TYPE_PREVIEW = {
  headline: { size: 36, weight: 800, lineHeight: 0.94 },
  story: { size: 14, weight: 500, lineHeight: 1.4 },
  quote: { size: 16, weight: 500, lineHeight: 1.3 },
  label: { size: 9, weight: 600, tracking: '0.14em' },
  footer: { size: 9, weight: 600, tracking: '0.12em' },
  insightTitle: { size: 8, weight: 600 },
  insightBody: { size: 10, weight: 500 },
} as const;

export const POSTER_SHADOWS = {
  headline: '0 3px 18px rgba(0,0,0,0.36)',
  story: '0 2px 12px rgba(0,0,0,0.28)',
  glassCard: '0 10px 32px rgba(23,32,51,0.08)',
  mainCard: '0 18px 60px rgba(23,32,51,0.10)',
} as const;

export const POSTER_INSIGHT_PREVIEW = {
  minHeight: 92,
  maxHeight: 120,
  minColumnWidth: 100,
  gapPercent: 2.5,
  cardWidthPercent: 31.5,
  labelSize: 8,
  bodySize: 10,
  progressHeight: 4,
} as const;

export const POSTER_QUOTE_PREVIEW = {
  minHeight: 88,
  maxHeight: 110,
} as const;

export const Z_INDEX = {
  scene: 1,
  globalGradient: 2,
  localScrim: 3,
  typography: 4,
  insightCards: 5,
  footer: 6,
} as const;

export function posterExportPx(previewPx: number): number {
  return Math.round(previewPx * POSTER_SCALE);
}

export function buildPosterEditorialCssVars(): Record<string, string> {
  return {
    ['--poster-scale' as string]: String(POSTER_SCALE),
    ['--poster-safe-top' as string]: `${SAFE_PREVIEW.top}px`,
    ['--poster-safe-bottom' as string]: `${SAFE_PREVIEW.bottom}px`,
    ['--poster-safe-left' as string]: `${SAFE_PREVIEW.left}px`,
    ['--poster-safe-right' as string]: `${SAFE_PREVIEW.right}px`,
    ['--poster-grid-gap' as string]: `${GRID_PREVIEW.columnGap}px`,
    ['--poster-content-pad' as string]: `${GRID_PREVIEW.outerPadding}px`,
    ['--poster-accent-glow' as string]: 'rgba(123, 97, 255, 0.1)',
    ['--poster-zone-rows' as string]: POSTER_ZONE_GRID_ROWS,
  };
}
