import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildPosterCardContent, resolvePosterIdentityDisplay } from '@/lib/eza/mirror/posterCardContent';
import { posterCardSkinIdentity } from '@/lib/eza/mirror/posterCardSkin';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const identitySrc = readFileSync(
  join(process.cwd(), 'components/mirror/PosterIdentityHeadline.tsx'),
  'utf8'
);

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
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
    expect(posterCardSkinIdentity.fullCanvasLayer).toContain('absolute inset-0');
    expect(posterCardSkinIdentity.overlayStack).toContain('relative z-10');
    expect(posterCardSkinIdentity.sceneWindowOuter).toBeUndefined();
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
    expect(identitySrc).toContain('identityMirrorMoment');
    expect(identitySrc).toContain('mirrorMomentLine');
    expect(identitySrc).toContain('formatPosterMirrorMomentDisplay');
    expect(identitySrc).not.toMatch(/Mirror Moment:/i);
    expect(identitySrc).not.toMatch(/Story Tension:/i);
    expect(posterCardSkinIdentity.identityMirrorMoment).toContain('italic');

    const id = resolvePosterIdentityDisplay({
      ...baseCard,
      mirrorMoment: 'Standing still before choosing.',
      storyTensionTitle: 'Two paths. One decision.',
    });
    expect(id.mirrorMomentLine).toContain('Standing still');
    expect(id.avatarName).toBe('Şefkatli Geyik');
    expect(id.themeTitle).toBe('İlişki & Bağ');
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
