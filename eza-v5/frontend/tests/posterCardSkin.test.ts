import { describe, it, expect } from 'vitest';
import {
  posterCardSkin,
  posterCardSkinIdentity,
  getPosterCardSkin,
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
    expect(POSTER_SCENE_DOMINANCE_RATIO).toBeGreaterThanOrEqual(0.38);
    expect(POSTER_CARD_WIDTH_PX).toBeGreaterThanOrEqual(420);
    expect(POSTER_CARD_WIDTH_PX).toBeLessThanOrEqual(460);
  });

  it('P4-B identity skin uses full-canvas layer and glass overlay tokens', () => {
    expect(posterCardSkinIdentity.fullCanvasLayer).toContain('absolute inset-0');
    expect(posterCardSkinIdentity.overlayStack).toContain('relative z-10');
    expect(posterCardSkinIdentity.overlayTopScrim).toBeTruthy();
    expect(posterCardSkinIdentity.overlayBottomScrim).toBeTruthy();
    const warm = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(warm.rhythmWhisperZone).toContain('backdrop-blur-sm');
    expect(warm.rhythmWhisperZone).toContain('amber');
    expect(warm.rhythmWhisperWord).toContain('text-[12px]');
    expect(warm.relationshipHeroScore).toBe('hidden');
    expect(posterCardSkinIdentity.relationshipAccentTrack).toBe('hidden');
    expect(posterCardSkinIdentity.tomorrowWhisper).toContain('text-white/55');
    expect(posterCardSkinIdentity.insightsCompact).toBe('hidden');
    expect(posterCardSkinIdentity.sceneWindowOuter).toBeUndefined();
  });
});
