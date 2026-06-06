import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildPosterCardContent, resolvePosterIdentityDisplay } from '@/lib/eza/mirror/posterCardContent';
import { getPosterCardSkin } from '@/lib/eza/mirror/posterCardSkin';
import { resolvePosterSceneTone } from '@/lib/eza/mirror/posterSceneTone';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const identitySrc = readFileSync(
  join(process.cwd(), 'components/mirror/PosterIdentityHeadline.tsx'),
  'utf8'
);

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
  'utf8'
);

const reflectionSrc = readFileSync(
  join(process.cwd(), 'components/mirror/PosterReflectionSummary.tsx'),
  'utf8'
);

const tomorrowSrc = readFileSync(
  join(process.cwd(), 'components/mirror/PosterTomorrowHint.tsx'),
  'utf8'
);

const fullCanvasSrc = readFileSync(
  join(process.cwd(), 'components/mirror/FullCanvasScene.tsx'),
  'utf8'
);

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

const baseCard: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: '21 Mayıs 2026',
  headline: 'Test',
  characterName: 'Köprü Kurucu',
  personaFamilyId: 'sensitive_careful',
  shortInsight: 'Insight',
  userLine: 'İletişimde yumuşak adımlar attın.',
  aiLine: 'Empati tonunu korudu.',
  balanceLine: 'Bugünkü etkileşim sakin bir ritimde ilerledi.',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 72,
  shareEnabled: true,
  privacyText: 'privacy',
  dailyAvatarName: 'Şefkatli Geyik',
  dailyAvatarEmoji: '🦌',
  behaviorFamilyLabel: 'Hassasiyet Ailesi',
  dailyThemeTitle: 'İlişki & Bağ',
  dailyThemeSubtitle: 'Empati, güven ve iletişim',
  tomorrowHint: 'Yarın için küçük bir adım yeterli olabilir.',
};

describe('DailyMirrorPosterCard P4-B full-canvas', () => {
  it('mirror page imports DailyMirrorPosterCard not legacy DailyMirrorCard', () => {
    expect(experienceSrc).toContain('DailyMirrorPosterCard');
    expect(experienceSrc).toContain('DailyMirrorSharePoster');
    expect(experienceSrc).not.toMatch(/import\s+DailyMirrorCard\s+from/);
  });

  it('uses FullCanvasScene overlay stack, not PosterSceneWindow', () => {
    expect(posterSrc).toContain('v10-full-canvas');
    expect(posterSrc).toContain('FullCanvasScene');
    expect(posterSrc).toContain('overlayStack');
    expect(posterSrc).not.toContain('PosterSceneWindow');
    expect(posterSrc).not.toContain('gridTemplateRows');
    expect(posterSrc).toContain('data-mirror-card-root');
    expect(posterSrc).toContain('data-mirror-aspect="9-16"');
  });

  it('FullCanvasScene uses bleed layout and absolute inset-0 layer', () => {
    expect(fullCanvasSrc).toContain('layout="bleed"');
    expect(fullCanvasSrc).toContain('fullCanvasLayer');
    expect(fullCanvasSrc).toContain('fullCanvasGeneratingRing');
    expect(fullCanvasSrc).toContain('fullCanvasAwaiting');
    const warmSkin = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(warmSkin.fullCanvasLayer).toContain('absolute inset-0');
    expect(warmSkin.overlayStack).toContain('relative z-10');
    expect(warmSkin.overlayIdentity).not.toContain('border');
    expect(warmSkin.overlayIdentity).toContain('text-center');
    expect(warmSkin.sceneWindowOuter).toBeUndefined();
  });

  it('resolvePosterIdentityDisplay is text-only (no image/emoji urls)', () => {
    const content = buildPosterCardContent(baseCard);
    const id = resolvePosterIdentityDisplay(baseCard, content);
    expect(id.avatarName).toBe('Şefkatli Geyik');
    expect(id.behaviorFamilyLabel).toBe('Hassasiyet Ailesi');
    expect(id.themeTitle).toBe('İlişki & Bağ');
    expect(id).not.toHaveProperty('avatarEmoji');
    expect(id).not.toHaveProperty('personaImageUrl');
  });

  it('P4-C1 shows mirror moment in identity without technical labels', () => {
    const warmSkin = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(identitySrc).toContain('identityMirrorMoment');
    expect(identitySrc).toContain('mirrorMomentLine');
    expect(identitySrc).toContain('formatPosterMirrorMomentDisplay');
    expect(identitySrc).not.toMatch(/Mirror Moment:/i);
    expect(identitySrc).not.toMatch(/Story Tension:/i);
    expect(warmSkin.identityMirrorMoment).toContain('italic');

    const id = resolvePosterIdentityDisplay({
      ...baseCard,
      mirrorMoment: 'Standing still before choosing.',
      storyTensionTitle: 'Two paths. One decision.',
    });
    expect(id.mirrorMomentLine).toContain('Standing still');
    expect(id.avatarName).toBe('Şefkatli Geyik');
    expect(id.themeTitle).toBe('İlişki & Bağ');
  });

  it('P4-C3 story-first reflection: rhythm whisper only, no analytics UI', () => {
    const warmSkin = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(reflectionSrc).toContain('rhythmWhisperEyebrow');
    expect(reflectionSrc).toContain('rhythmWhisperWord');
    expect(reflectionSrc).not.toContain('heroScore');
    expect(reflectionSrc).not.toContain('relationshipHeroScore');
    expect(reflectionSrc).not.toContain('relationshipAccentTrack');
    expect(reflectionSrc).not.toContain('journeyHeadline');
    expect(reflectionSrc).not.toContain('storyLine');
    expect(reflectionSrc).not.toContain('senMicro');
    expect(reflectionSrc).not.toContain('aiMicro');
    expect(reflectionSrc).not.toContain('MiniInsight');
    expect(posterSrc).toContain('content.rhythm');
    expect(posterSrc).toContain('rhythmWhisperZone');
    expect(warmSkin.relationshipHeroScore).toBe('hidden');
    expect(warmSkin.relationshipAccentTrack).toBe('hidden');

    const c = buildPosterCardContent(baseCard);
    expect(c.rhythm.eyebrow).toBe('İlişki Ritmi');
    expect(c.rhythm.word).toBe('Dengeleniyor');
    expect(c.storyLine.length).toBeGreaterThan(0);
    expect(c.journeyHeadline.length).toBeGreaterThan(0);
  });

  it('P4-C4 wires adaptive scene tone on poster card', () => {
    expect(posterSrc).toContain('resolvePosterSceneTone');
    expect(posterSrc).toContain('data-mirror-scene-tone');
    expect(posterSrc).toContain('getPosterCardSkin(palette');
    const tone = resolvePosterSceneTone({
      ...baseCard,
      narrativeCoreId: 'exploration',
      sceneArchetypeId: 'threshold',
      dailyThemeTitle: 'Keşif',
    });
    expect(tone.id).toBe('warm_gold');
  });

  it('P4-C3 tomorrow hint is a quiet footer line, not a second card', () => {
    expect(tomorrowSrc).toContain('tomorrowWhisper');
    expect(tomorrowSrc).not.toContain('tomorrowZone');
    const warmSkin = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(warmSkin.tomorrowZone).toBe('hidden');
  });

  it('applies inline readability styles and bottom tomorrow whisper without branding footer', () => {
    expect(posterSrc).toContain('POSTER_READABILITY_INLINE');
    expect(posterSrc).toContain('datePillGlass');
    expect(posterSrc).toContain('overlayFooterScrim');
    expect(posterSrc).toContain('PosterTomorrowHint');
    expect(posterSrc).not.toContain('#EZAİlişkiAynası');
    expect(posterSrc).not.toContain('eza.ai');
    const warmSkin = getPosterCardSkin('default_dark_scrim', 'identity_first', 'warm_gold');
    expect(warmSkin.datePill).toContain('text-[#FFF8F0]');
    expect(warmSkin.footer).toBe('hidden');
    expect(warmSkin.tomorrowWhisper).toContain('drop-shadow');
  });
});
