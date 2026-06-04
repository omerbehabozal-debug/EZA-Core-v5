import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STYLE_LENS_ID,
  getNextStyleLensId,
  getStyleLens,
  STYLE_LENS_PLUS_CYCLE,
  STYLE_LENS_REGISTRY,
} from '@/lib/eza/mirror/styleLensRegistry';

describe('styleLensRegistry', () => {
  it('exposes eight lenses with premium_human as default', () => {
    expect(STYLE_LENS_PLUS_CYCLE).toHaveLength(8);
    expect(DEFAULT_STYLE_LENS_ID).toBe('premium_human');
    expect(STYLE_LENS_REGISTRY.curious_panda.plusOnly).toBe(true);
    expect(STYLE_LENS_REGISTRY.premium_human.plusOnly).toBe(false);
  });

  it('rotates through Plus cycle deterministically', () => {
    expect(getNextStyleLensId('premium_human')).toBe('curious_panda');
    expect(getNextStyleLensId('curious_panda')).toBe('cinematic_no_character');
    expect(getNextStyleLensId('minimal_poetic')).toBe('premium_human');
  });

  it('curious_panda prompt block rejects mascot tone', () => {
    const block = getStyleLens('curious_panda').promptBlock;
    expect(block).toMatch(/style lens:/i);
    expect(block).toMatch(/not a cute mascot/i);
    expect(block).toMatch(/not a sticker/i);
  });
});
