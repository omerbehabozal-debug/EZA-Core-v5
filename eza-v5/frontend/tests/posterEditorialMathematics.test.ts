import { describe, it, expect } from 'vitest';
import {
  POSTER_SCALE,
  POSTER_PREVIEW_WIDTH_PX,
  POSTER_PREVIEW_HEIGHT_PX,
  POSTER_EXPORT_WIDTH_PX,
  POSTER_EXPORT_HEIGHT_PX,
  SAFE_PREVIEW,
  GRID_PREVIEW,
  POSTER_READABILITY_SHADOW,
  POSTER_READABILITY_INLINE,
  POSTER_RHYTHM_GLASS,
  POSTER_SHARE_SCRIM_BOOST,
  POSTER_FOOTER_ZONE_SCRIM,
  POSTER_DATE_PILL_GLASS,
  buildPosterEditorialCssVars,
  posterExportPx,
} from '@/lib/eza/mirror/posterEditorialMathematics';

describe('posterEditorialMathematics (Sprint 12A)', () => {
  it('preview scales 2.5x to export dimensions', () => {
    expect(POSTER_SCALE).toBe(2.5);
    expect(POSTER_PREVIEW_WIDTH_PX * POSTER_SCALE).toBe(POSTER_EXPORT_WIDTH_PX);
    expect(POSTER_PREVIEW_HEIGHT_PX * POSTER_SCALE).toBe(POSTER_EXPORT_HEIGHT_PX);
  });

  it('safe area preview matches export ratio', () => {
    expect(SAFE_PREVIEW.top * POSTER_SCALE).toBe(110);
    expect(SAFE_PREVIEW.bottom * POSTER_SCALE).toBe(140);
    expect(SAFE_PREVIEW.left).toBe(22);
    expect(SAFE_PREVIEW.left * POSTER_SCALE).toBe(55);
  });

  it('12-column grid content width', () => {
    expect(GRID_PREVIEW.container - GRID_PREVIEW.outerPadding * 2).toBe(
      GRID_PREVIEW.contentWidth
    );
  });

  it('exports CSS vars for card root', () => {
    const vars = buildPosterEditorialCssVars();
    expect(vars['--poster-safe-top']).toBe('44px');
    expect(vars['--poster-zone-rows']).toBeDefined();
  });

  it('typography export scale', () => {
    expect(posterExportPx(36)).toBe(90);
  });

  it('exports readability shadow, rhythm glass and share scrim tokens', () => {
    expect(POSTER_READABILITY_SHADOW.headline).toContain('drop-shadow');
    expect(POSTER_READABILITY_SHADOW.masthead).toContain('drop-shadow');
    expect(POSTER_RHYTHM_GLASS).toContain('backdrop-blur-3xl');
    expect(POSTER_RHYTHM_GLASS).toContain('linear-gradient');
    expect(POSTER_SHARE_SCRIM_BOOST.top).toContain('bg-gradient-to-b');
    expect(POSTER_SHARE_SCRIM_BOOST.bottom).toContain('bg-gradient-to-t');
    expect(POSTER_READABILITY_INLINE.masthead.color).toBe('#FFF8F0');
    expect(POSTER_READABILITY_INLINE.footer.textShadow).toContain('rgba');
    expect(POSTER_FOOTER_ZONE_SCRIM).toContain('radial-gradient');
    expect(POSTER_DATE_PILL_GLASS).toContain('backdrop-blur-md');
  });
});
