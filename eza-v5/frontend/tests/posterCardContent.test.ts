import { describe, it, expect } from 'vitest';
import {
  formatPosterMirrorMomentDisplay,
  resolvePosterMirrorMoment,
  resolvePosterIdentityDisplay,
} from '@/lib/eza/mirror/posterCardContent';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const base: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: 'Bugün',
  headline: 'Fallback headline',
  characterName: 'Test',
  personaFamilyId: 'decision_direction',
  shortInsight: 'Short insight line',
  userLine: 'u',
  aiLine: 'a',
  balanceLine: 'b',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 50,
  shareEnabled: true,
  privacyText: 'p',
  dailyAvatarName: 'Durgun Göl',
  dailyThemeTitle: 'Araç Kararı',
};

describe('resolvePosterMirrorMoment (P4-C1)', () => {
  it('prefers mirrorMoment over storyTensionTitle', () => {
    const line = resolvePosterMirrorMoment({
      ...base,
      mirrorMoment: 'Standing still before choosing.',
      storyTensionTitle: 'Two paths. One decision.',
    });
    expect(line).toBe('Standing still before choosing.');
  });

  it('falls back to storyTensionTitle when mirrorMoment absent', () => {
    const line = resolvePosterMirrorMoment({
      ...base,
      storyTensionTitle: 'Two paths. One decision.',
    });
    expect(line).toBe('Two paths. One decision.');
  });

  it('falls back to shortInsight then headline', () => {
    expect(resolvePosterMirrorMoment({ ...base, shortInsight: 'Calm search.' })).toBe(
      'Calm search.'
    );
    expect(
      resolvePosterMirrorMoment({
        ...base,
        shortInsight: '',
        headline: 'Journey headline',
      })
    ).toBe('Journey headline');
  });

  it('formatPosterMirrorMomentDisplay uses editorial quotes without label', () => {
    expect(formatPosterMirrorMomentDisplay('Standing still before choosing.')).toBe(
      '“Standing still before choosing.”'
    );
    expect(formatPosterMirrorMomentDisplay('“Already quoted.”')).toBe('“Already quoted.”');
  });
});

describe('resolvePosterIdentityDisplay mirror moment line', () => {
  it('includes mirrorMomentLine on identity display', () => {
    const id = resolvePosterIdentityDisplay({
      ...base,
      mirrorMoment: 'Looking beyond the familiar.',
    });
    expect(id.mirrorMomentLine).toBe('Looking beyond the familiar.');
    expect(id.avatarName).toBe('Durgun Göl');
    expect(id.themeTitle).toBe('Araç Kararı');
  });
});
