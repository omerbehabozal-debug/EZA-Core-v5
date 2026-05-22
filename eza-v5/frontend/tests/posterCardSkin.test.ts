import { describe, it, expect } from 'vitest';
import {
  posterCardSkin,
  POSTER_CARD_WIDTH_PX,
  POSTER_SCENE_DOMINANCE_RATIO,
} from '@/lib/eza/mirror/posterCardSkin';

describe('posterCardSkin', () => {
  it('uses 9:16 premium editorial math tokens (Sprint 12A)', () => {
    expect(posterCardSkin.root).toContain('aspect-[9/16]');
    expect(posterCardSkin.root).toContain('#F8F6F1');
    expect(posterCardSkin.sceneBackdrop).toContain('z-[1]');
    expect(posterCardSkin.heroTitle).toContain('text-[36px]');
    expect(posterCardSkin.insightCard).toContain('backdrop-blur');
    expect(posterCardSkin.contentStack).toContain('--poster-safe-top');
    expect(posterCardSkin.insightLine).toContain('text-[10px]');
    expect(POSTER_SCENE_DOMINANCE_RATIO).toBeGreaterThanOrEqual(0.65);
    expect(POSTER_CARD_WIDTH_PX).toBeGreaterThanOrEqual(420);
    expect(POSTER_CARD_WIDTH_PX).toBeLessThanOrEqual(460);
  });
});
