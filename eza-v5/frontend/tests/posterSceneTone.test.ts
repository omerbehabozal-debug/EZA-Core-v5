import { describe, it, expect } from 'vitest';
import { resolvePosterSceneTone } from '@/lib/eza/mirror/posterSceneTone';
import type { PosterSceneToneId } from '@/lib/eza/mirror/posterSceneTone';
import { getPosterCardSkin } from '@/lib/eza/mirror/posterCardSkin';
import { POSTER_READABILITY_SHADOW, POSTER_RHYTHM_GLASS } from '@/lib/eza/mirror/posterEditorialMathematics';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const base: DailyMirrorCardModel = {
  date: '2026-06-04',
  dayLabel: 'Bugün',
  headline: 'Test',
  characterName: 'Test',
  personaFamilyId: 'decision_direction',
  shortInsight: 'x',
  userLine: 'u',
  aiLine: 'a',
  balanceLine: 'b',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 70,
  shareEnabled: true,
  privacyText: 'p',
  dailyAvatarName: 'Avatar',
  dailyThemeTitle: 'Tema',
};

describe('resolvePosterSceneTone (P4-C4)', () => {
  it('maps exploration + threshold to warm_gold', () => {
    const t = resolvePosterSceneTone({
      ...base,
      narrativeCoreId: 'exploration',
      sceneArchetypeId: 'threshold',
      dailyThemeTitle: 'Keşif',
      dailyThemeSubtitle: 'Seyahat ve bağlantı',
    });
    expect(t.id).toBe('warm_gold');
    expect(t.tone).toBe('warm');
    expect(t.accent).toBe('gold');
  });

  it('maps travel topic to warm_gold', () => {
    const t = resolvePosterSceneTone({
      ...base,
      storyTopicKey: 'travel',
      dailyThemeTitle: 'İtalyan Sohbeti',
    });
    expect(t.id).toBe('warm_gold');
  });

  it('maps comparison_studio to dark_gold', () => {
    const t = resolvePosterSceneTone({
      ...base,
      sceneArchetypeId: 'comparison_studio',
      visual: {
        characterId: 'x',
        characterName: 'x',
        personaFamilyId: 'decision_direction',
        topicLabel: '',
        atmosphereLabel: '',
        emotionLabel: '',
        prompt: '',
        negativePrompt: '',
        stylePreset: 'eza_mirror_professional_v1',
        seedHint: 's',
        lockedPrimaryIntent: 'premium_vehicle_comparison',
      },
    });
    expect(t.id).toBe('dark_gold');
    expect(t.contrast).toBe('dark-scene');
  });

  it('maps sanctuary to rose_warm', () => {
    const t = resolvePosterSceneTone({
      ...base,
      narrativeCoreId: 'care',
      sceneArchetypeId: 'sanctuary',
    });
    expect(t.id).toBe('rose_warm');
    expect(t.accent).toBe('rose');
  });

  it('maps quiet_mirror to cool_silver', () => {
    const t = resolvePosterSceneTone({
      ...base,
      narrativeCoreId: 'clarity',
      sceneArchetypeId: 'quiet_mirror',
    });
    expect(t.id).toBe('cool_silver');
    expect(t.tone).toBe('cool');
    expect(t.accent).toBe('silver');
  });

  it('applyPosterSceneToneSkin uses warm amber panel border with radial veil not boxed panel', () => {
    const skin = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(skin.overlayIdentity).toContain('radial-gradient');
    expect(skin.overlayIdentity).toContain('backdrop-blur');
    expect(skin.overlayIdentity).not.toContain('border border-');
    expect(skin.rhythmWhisperZone).toContain('amber');
    expect(skin.logoText).toContain('text-[#FFF8F0]');
    expect(skin.datePill).toContain('text-[#FFF8F0]');
  });

  it.each<PosterSceneToneId>([
    'warm_gold',
    'cool_silver',
    'dark_gold',
    'rose_warm',
    'neutral_silver',
  ])('tone %s keeps hex ink and readability shadows from base identity skin', (toneId) => {
    const skin = getPosterCardSkin('default_dark_scrim', 'identity_first', toneId);
    expect(skin.identityAvatarName).toContain(POSTER_READABILITY_SHADOW.headline);
    expect(skin.identityMirrorMoment).toContain(POSTER_READABILITY_SHADOW.quote);
    expect(skin.logoText).toContain('text-[#FFF8F0]');
    expect(skin.datePill).toContain('text-[#FFF8F0]');
    expect(skin.rhythmWhisperWord).toContain('text-[#FFF8F0]');
    expect(skin.insightPanelDesc).toContain('text-[#F0EEEA]');
    expect(skin.insightPanelDesc).toContain(POSTER_READABILITY_SHADOW.body);
    expect(skin.footer).toBe('hidden');
    expect(skin.tomorrowWhisper).toContain('text-[#EDE9E3]');
    expect(skin.rhythmWhisperZone).toContain('backdrop-blur');
    expect(skin.rhythmWhisperZone).toContain(POSTER_RHYTHM_GLASS);
    expect(skin.overlayTopScrim).toBeTruthy();
    expect(skin.overlayBottomScrim).toBeTruthy();
    expect(skin.overlayFooterScrim).toBeTruthy();
    expect(skin.datePillGlass).toBeTruthy();
  });
});
