import { describe, it, expect } from 'vitest';
import {
  posterCardSkin,
  POSTER_CARD_WIDTH_PX,
  POSTER_SCENE_DOMINANCE_RATIO,
} from '@/lib/eza/mirror/posterCardSkin';

describe('posterCardSkin', () => {
  it('uses 9:16 composition poster tokens (Sprint 11L)', () => {
    expect(posterCardSkin.root).toContain('aspect-[9/16]');
    expect(posterCardSkin.sceneBackdrop).toContain('absolute inset-0');
    expect(posterCardSkin.heroTitle).toContain('text-[32px]');
    expect(posterCardSkin.highlightWhisper).toContain('backdrop-blur');
    expect(posterCardSkin.bottomSafeZone).toContain('backdrop-blur');
    expect(POSTER_SCENE_DOMINANCE_RATIO).toBeGreaterThanOrEqual(0.65);
    expect(POSTER_CARD_WIDTH_PX).toBeGreaterThanOrEqual(420);
    expect(POSTER_CARD_WIDTH_PX).toBeLessThanOrEqual(460);
  });
});
