import { describe, it, expect } from 'vitest';
import {
  posterCardSkin,
  posterCardSkinIdentity,
  getPosterCardSkin,
  sharePosterReadabilityLayers,
  sharePosterReadabilityText,
  POSTER_CARD_WIDTH_PX,
  POSTER_SCENE_DOMINANCE_RATIO,
} from '@/lib/eza/mirror/posterCardSkin';
import {
  POSTER_READABILITY_SHADOW,
  POSTER_RHYTHM_GLASS,
} from '@/lib/eza/mirror/posterEditorialMathematics';

describe('posterCardSkin', () => {
  it('uses 9:16 premium editorial math tokens (Sprint 12A)', () => {
    expect(posterCardSkin.root).toContain('aspect-[9/16]');
    expect(posterCardSkin.root).toContain('#F8F6F1');
    expect(posterCardSkin.sceneBackdrop).toContain('z-[1]');
    expect(posterCardSkin.heroTitle).toContain('text-[44px]');
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
    expect(warm.rhythmWhisperZone).toContain('backdrop-blur');
    expect(warm.rhythmWhisperZone).toContain('amber');
    expect(posterCardSkinIdentity.rhythmWhisperWord).toContain('font-serif');
    expect(warm.insightPanelDesc).toBeTruthy();
    expect(warm.relationshipHeroScore).toBe('hidden');
    expect(posterCardSkinIdentity.relationshipAccentTrack).toBe('hidden');
    expect(posterCardSkinIdentity.tomorrowWhisper).toContain('text-[#EDE9E3]');
    expect(posterCardSkinIdentity.root).toContain('--poster-display-max-width');
    expect(posterCardSkinIdentity.insightsCompact).toBe('hidden');
    expect(posterCardSkinIdentity.sceneWindowOuter).toBeUndefined();
  });

  it('identity skin applies readability scrim, glass panel and text-shadow stacks', () => {
    expect(posterCardSkinIdentity.overlayTopScrim).toContain('h-[34%]');
    expect(posterCardSkinIdentity.overlayBottomScrim).toContain('h-[62%]');
    expect(posterCardSkinIdentity.overlayHeader).toContain('backdrop-blur');
    expect(posterCardSkinIdentity.overlayIdentity).toContain('radial-gradient');
    expect(posterCardSkinIdentity.identityAvatarName).toContain(
      POSTER_READABILITY_SHADOW.headline
    );
    expect(posterCardSkinIdentity.identityMirrorMoment).toContain(
      POSTER_READABILITY_SHADOW.quote
    );
    expect(posterCardSkinIdentity.logoText).toContain(POSTER_READABILITY_SHADOW.masthead);
    expect(posterCardSkinIdentity.rhythmWhisperZone).toContain(POSTER_RHYTHM_GLASS);
    expect(posterCardSkinIdentity.rhythmWhisperZone).toContain('backdrop-blur-3xl');
    expect(posterCardSkinIdentity.insightPanelDesc).toContain('text-[#F0EEEA]');
    expect(posterCardSkinIdentity.insightPanelScoreItem).toContain('text-[#F0EEEA]');
    expect(posterCardSkinIdentity.datePillGlass).toContain('backdrop-blur-md');
    expect(posterCardSkinIdentity.overlayFooterScrim).toContain('radial-gradient');
    expect(posterCardSkinIdentity.footer).toBe('hidden');
    expect(sharePosterReadabilityLayers.top).toContain('bg-gradient-to-b');
    expect(sharePosterReadabilityLayers.bottom).toContain('bg-gradient-to-t');
    expect(sharePosterReadabilityText.headline).toContain('drop-shadow');
  });
});
