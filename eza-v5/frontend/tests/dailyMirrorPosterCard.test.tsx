import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildPosterCardContent, resolvePosterIdentityDisplay } from '@/lib/eza/mirror/posterCardContent';
import { POSTER_IDENTITY_ZONE_GRID_ROWS } from '@/lib/eza/mirror/posterEditorialMathematics';
import { posterCardSkinIdentity } from '@/lib/eza/mirror/posterCardSkin';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
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

describe('DailyMirrorPosterCard P2 scene-hero revision', () => {
  it('mirror page imports DailyMirrorPosterCard not legacy DailyMirrorCard', () => {
    expect(experienceSrc).toContain('DailyMirrorPosterCard');
    expect(experienceSrc).not.toMatch(/import\s+DailyMirrorCard\s+from/);
  });

  it('uses text-only identity headline and dominant scene window', () => {
    expect(posterSrc).toContain('v9b-scene-hero');
    expect(posterSrc).toContain('PosterIdentityHeadline');
    expect(posterSrc).toContain('PosterSceneWindow');
    expect(posterSrc).not.toContain('PosterAvatarHero');
    expect(posterSrc).not.toContain('PosterThemeBand');
    expect(posterSrc).not.toContain('/personas/');
    expect(posterSrc).not.toContain('dailyAvatarEmoji');
    expect(posterSrc).not.toContain('personaImageUrl');
    expect(posterSrc).toContain('PosterIdentityHeadline');
  });

  it('scene-first grid ratios (~45% scene row)', () => {
    expect(POSTER_IDENTITY_ZONE_GRID_ROWS).toMatch(/8%.*12%.*45%/);
    expect(posterCardSkinIdentity.sceneWindowOuter).toContain('min-h-[200px]');
    expect(posterCardSkinIdentity.sceneWindowOuter).toMatch(/aspect-\[4\/5\]/);
    expect(posterCardSkinIdentity.identityAvatarName).toBeTruthy();
    expect(posterCardSkinIdentity.avatarImage).toBeUndefined();
    expect(posterCardSkinIdentity.avatarEmoji).toBeUndefined();
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

  it('poster activities use Sen/AI/Denge labels only', () => {
    const c = buildPosterCardContent({
      ...baseCard,
      userLine: 'Sen line',
      aiLine: 'AI line',
      balanceLine: 'Balance line',
    });
    expect(c.activities.map((a) => a.label)).toEqual(['Sen', 'AI', 'Denge']);
  });
});
