import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const posterSrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorPosterCard.tsx'),
  'utf8'
);

const skinSrc = readFileSync(
  join(process.cwd(), 'lib/eza/mirror/posterCardSkin.ts'),
  'utf8'
);

const experienceSrc = readFileSync(
  join(process.cwd(), 'components/standalone/StandaloneObservationExperience.tsx'),
  'utf8'
);

const legacySrc = readFileSync(
  join(process.cwd(), 'components/mirror/DailyMirrorCard.tsx'),
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
};

describe('DailyMirrorPosterCard wiring', () => {
  it('mirror page imports DailyMirrorPosterCard not legacy DailyMirrorCard', () => {
    expect(experienceSrc).toContain('DailyMirrorPosterCard');
    expect(experienceSrc).not.toMatch(/import\s+DailyMirrorCard\s+from/);
  });

  it('poster component has 9:16 visual-dominant layout and Sen/AI/Denge blocks', () => {
    expect(posterSrc).toContain('data-mirror-card-root');
    expect(posterSrc).toContain('data-mirror-aspect="9-16"');
    expect(posterSrc).toContain('data-mirror-poster="v7-editorial-contrast"');
    expect(posterSrc).toContain('ContextualHighlightBand');
    expect(posterSrc).toContain('titleSafeZone');
    expect(posterSrc).toContain('posterReadabilitySystem');
    expect(posterSrc).toContain('storyWrap');
    expect(skinSrc).toContain('aspect-[9/16]');
    expect(skinSrc).toContain('sceneBackdrop');
    expect(posterSrc).toContain('sceneBackdrop');
    expect(posterSrc).toContain('gridTemplateRows');
    expect(posterSrc).not.toContain('metricsGlass');
    expect(posterSrc).not.toContain('glassTheme');
    expect(posterSrc).toContain('label="Sen"');
    expect(posterSrc).toContain('label="AI"');
    expect(posterSrc).toContain('label="Denge"');
    expect(posterSrc).not.toContain('Bugün ne yaptın');
    expect(posterSrc).not.toContain('İlişki dengen');
  });

  it('legacy DailyMirrorCard still contains old report headings (unused on mirror)', () => {
    expect(legacySrc).toContain('DailyMirrorCard');
    expect(legacySrc).not.toContain('Bugün ne yaptın');
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
