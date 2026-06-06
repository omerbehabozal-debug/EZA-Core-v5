/**
 * Premium editorial card mathematics — Sprint 12A.
 * Preview 432×768 · export 1080×1920 · 2.5× scale.
 */

export const POSTER_SCALE = 2.5;

export const POSTER_PREVIEW_WIDTH_PX = 432;
export const POSTER_PREVIEW_HEIGHT_PX = 768;

/** In-app display cap (export capture still uses preview baseline). */
export const POSTER_DISPLAY_MAX_PX = 580;

/** Responsive width: mobile-safe, desktop hero poster. */
export const POSTER_DISPLAY_MAX_WIDTH_CSS =
  'min(100%, clamp(23rem, 50vw, 38rem))';

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

/** CSS grid rows — hybrid: collapse frontend typography zones; scene fills middle. */
export const POSTER_HYBRID_ZONE_GRID_ROWS = '9% minmax(62%,1fr) 16% 6%';

/** CSS grid rows for content stack */
export const POSTER_ZONE_GRID_ROWS =
  '9% 20% minmax(38%,1fr) 14% 16% 6%';

/** P2 rev — scene-hero: headline metin, sahne baskın. */
export const POSTER_IDENTITY_ZONE_GRID_ROWS =
  '8% 12% minmax(45%,1fr) minmax(20%,1fr) 15%';

/** P2 rev hybrid — aynı sahne önceliği */
export const POSTER_IDENTITY_HYBRID_ZONE_GRID_ROWS =
  '8% 12% minmax(45%,1fr) minmax(18%,1fr) 15%';

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
  headline: { size: 44, weight: 700, lineHeight: 0.96 },
  story: { size: 15, weight: 500, lineHeight: 1.45 },
  quote: { size: 17, weight: 500, lineHeight: 1.35 },
  label: { size: 10, weight: 600, tracking: '0.18em' },
  footer: { size: 9, weight: 600, tracking: '0.14em' },
  insightTitle: { size: 9, weight: 600 },
  insightBody: { size: 12, weight: 500 },
  insightStatus: { size: 30, weight: 700, lineHeight: 1.05 },
} as const;

export const POSTER_SHADOWS = {
  headline: '0 4px 24px rgba(0,0,0,0.42)',
  story: '0 2px 16px rgba(0,0,0,0.32)',
  glassCard: '0 16px 48px rgba(0,0,0,0.28)',
  mainCard: '0 32px 96px -28px rgba(8,4,16,0.78)',
} as const;

/** Guaranteed light ink — hex avoids Tailwind opacity purge gaps on poster overlays. */
export const POSTER_READABILITY_COLORS = {
  masthead: '#FFF8F0',
  headline: '#FFF8F0',
  quote: '#FAF4EA',
  label: '#F5E8D4',
  body: '#F2F0EC',
  footer: '#EDE9E3',
  panelBody: '#F0EEEA',
  panelLabel: '#E8D5B5',
} as const;

/** Inline text-shadow — applied via style prop for guaranteed contrast. */
export const POSTER_READABILITY_TEXT_SHADOW = {
  masthead: '0 1px 2px rgba(0,0,0,0.92), 0 2px 14px rgba(0,0,0,0.65)',
  headline: '0 2px 4px rgba(0,0,0,0.92), 0 4px 32px rgba(0,0,0,0.68)',
  quote: '0 1px 3px rgba(0,0,0,0.88), 0 2px 20px rgba(0,0,0,0.62)',
  label: '0 1px 2px rgba(0,0,0,0.84), 0 2px 12px rgba(0,0,0,0.52)',
  body: '0 1px 2px rgba(0,0,0,0.82), 0 2px 12px rgba(0,0,0,0.5)',
  footer: '0 1px 3px rgba(0,0,0,0.86), 0 2px 10px rgba(0,0,0,0.54)',
} as const;

export type PosterReadabilityInlineStyle = {
  color: string;
  textShadow: string;
};

export const POSTER_READABILITY_INLINE: Record<
  keyof typeof POSTER_READABILITY_TEXT_SHADOW | 'panelBody' | 'panelLabel',
  PosterReadabilityInlineStyle
> = {
  masthead: {
    color: POSTER_READABILITY_COLORS.masthead,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.masthead,
  },
  headline: {
    color: POSTER_READABILITY_COLORS.headline,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.headline,
  },
  quote: {
    color: POSTER_READABILITY_COLORS.quote,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.quote,
  },
  label: {
    color: POSTER_READABILITY_COLORS.label,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.label,
  },
  body: {
    color: POSTER_READABILITY_COLORS.body,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.body,
  },
  footer: {
    color: POSTER_READABILITY_COLORS.footer,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.footer,
  },
  panelBody: {
    color: POSTER_READABILITY_COLORS.panelBody,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.body,
  },
  panelLabel: {
    color: POSTER_READABILITY_COLORS.panelLabel,
    textShadow: POSTER_READABILITY_TEXT_SHADOW.label,
  },
};

/** Layered text-shadow stacks — legibility on bright, dark and busy scenes. */
export const POSTER_READABILITY_SHADOW = {
  masthead:
    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] drop-shadow-[0_2px_14px_rgba(0,0,0,0.58)]',
  headline:
    'drop-shadow-[0_2px_4px_rgba(0,0,0,0.92)] drop-shadow-[0_4px_32px_rgba(0,0,0,0.68)]',
  quote:
    'drop-shadow-[0_1px_3px_rgba(0,0,0,0.88)] drop-shadow-[0_2px_20px_rgba(0,0,0,0.62)]',
  label:
    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.84)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.52)]',
  body:
    'drop-shadow-[0_1px_2px_rgba(0,0,0,0.82)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]',
  footer:
    'drop-shadow-[0_1px_3px_rgba(0,0,0,0.86)] drop-shadow-[0_2px_10px_rgba(0,0,0,0.54)]',
} as const;

/** Glass rhythm panel — elevated opacity without flat black box. */
export const POSTER_RHYTHM_GLASS =
  'bg-[linear-gradient(165deg,rgba(5,3,9,0.84)_0%,rgba(9,6,14,0.78)_55%,rgba(7,5,11,0.8)_100%)] backdrop-blur-3xl';

/** Share poster scrim boosts (applied in DailyMirrorSharePoster). */
export const POSTER_SHARE_SCRIM_BOOST = {
  top: 'absolute inset-x-0 top-0 z-[1] h-[28%] bg-gradient-to-b from-[rgba(5,3,8,0.58)] via-[rgba(8,5,12,0.22)] to-transparent pointer-events-none',
  bottom:
    'absolute inset-x-0 bottom-0 z-[1] h-[38%] bg-gradient-to-t from-[rgba(3,2,6,0.86)] via-[rgba(7,5,10,0.36)] to-transparent pointer-events-none',
} as const;

/** Footer whisper zone — radial lift behind tomorrow + branding lines. */
export const POSTER_FOOTER_ZONE_SCRIM =
  'pointer-events-none absolute inset-x-[-10%] bottom-[-6%] top-[-18%] z-0 bg-[radial-gradient(ellipse_110%_95%_at_50%_100%,rgba(3,2,6,0.82)_0%,rgba(6,4,10,0.48)_42%,transparent_72%)]';

/** Masthead date glass pill — readable on bright sky and dark vignette. */
export const POSTER_DATE_PILL_GLASS =
  'relative z-[1] inline-flex items-center gap-1.5 rounded-full border border-white/24 bg-[rgba(5,3,9,0.52)] px-2.5 py-1 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.38)]';

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
    ['--poster-display-max-width' as string]: POSTER_DISPLAY_MAX_WIDTH_CSS,
  };
}
