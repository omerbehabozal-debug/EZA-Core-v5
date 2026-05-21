import { describe, it, expect } from 'vitest';
import {
  posterCardSkin,
  POSTER_CARD_WIDTH_PX,
  POSTER_SCENE_DOMINANCE_RATIO,
} from '@/lib/eza/mirror/posterCardSkin';

describe('posterCardSkin', () => {
  it('uses 9:16 editorial contrast tokens (Sprint 11M)', () => {
    expect(posterCardSkin.root).toContain('aspect-[9/16]');
    expect(posterCardSkin.sceneBackdrop).toContain('absolute inset-0');
    expect(posterCardSkin.heroTitle).toContain('text-[34px]');
    expect(posterCardSkin.heroTitle).toContain('font-bold');
    expect(posterCardSkin.highlightWhisper).not.toContain('backdrop-blur');
    expect(posterCardSkin.bottomSafeZone).toContain('linear-gradient');
    expect(posterCardSkin.relationLine).toContain('text-[10.5px]');
    expect(POSTER_SCENE_DOMINANCE_RATIO).toBeGreaterThanOrEqual(0.65);
    expect(POSTER_CARD_WIDTH_PX).toBeGreaterThanOrEqual(420);
    expect(POSTER_CARD_WIDTH_PX).toBeLessThanOrEqual(460);
  });
});
