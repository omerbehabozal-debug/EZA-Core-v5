import { describe, it, expect } from 'vitest';
import {
  POSTER_SCALE,
  POSTER_PREVIEW_WIDTH_PX,
  POSTER_PREVIEW_HEIGHT_PX,
  POSTER_EXPORT_WIDTH_PX,
  POSTER_EXPORT_HEIGHT_PX,
  SAFE_PREVIEW,
  GRID_PREVIEW,
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
});
