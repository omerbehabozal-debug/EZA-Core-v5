import { describe, it, expect } from 'vitest';
import {
  POSTER_AREA_SCENE,
  POSTER_EXPORT_SCALE,
  POSTER_TYPE,
  getPosterComposition,
  highlightEmphasisFor,
  resolvePosterLayoutDensity,
} from '@/lib/eza/mirror/posterCompositionSystem';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const baseCard: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: '21 Mayıs 2026',
  headline: 'Test',
  characterName: 'Köprü Kurucu',
  personaFamilyId: 'sensitive_careful',
  shortInsight: 'Insight',
  userLine: 'Sen',
  aiLine: 'AI',
  balanceLine: 'Denge',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 72,
  shareEnabled: true,
  privacyText: 'privacy',
};

describe('posterCompositionSystem', () => {
  it('area budget sums to 1', () => {
    expect(POSTER_AREA_SCENE + 0.2 + 0.1).toBeCloseTo(1, 5);
  });

  it('export scale maps design type to 1080px width', () => {
    expect(POSTER_EXPORT_SCALE).toBe(2.5);
    expect(POSTER_TYPE.headline.exportPx).toBe(80);
    expect(POSTER_TYPE.story.exportPx).toBeGreaterThanOrEqual(30);
  });

  it('resolves comparison density for compare variant', () => {
    expect(
      resolvePosterLayoutDensity({ ...baseCard, storyVariant: 'compare' })
    ).toBe('comparison');
  });

  it('calm density uses whisper highlight for tag_focus', () => {
    const profile = getPosterComposition({ ...baseCard, storyTopicKey: 'health' });
    expect(profile.density).toBe('calm');
    expect(
      highlightEmphasisFor(profile.density, 'tag_focus')
    ).toBe('whisper');
  });

  it('comparison dual uses prominent emphasis', () => {
    expect(
      highlightEmphasisFor('comparison', 'dual_comparison')
    ).toBe('prominent');
  });
});
