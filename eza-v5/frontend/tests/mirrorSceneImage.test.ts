import { describe, it, expect } from 'vitest';
import { mergeDailyCardSceneVisual } from '@/lib/eza/mirror/mirrorSceneImage';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const baseCard: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: 'Bugün',
  headline: 'Test',
  characterName: 'Sakin',
  personaFamilyId: 'balanced_calm',
  shortInsight: 'Insight',
  userLine: 'u',
  aiLine: 'a',
  balanceLine: 'b',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Ritim',
  energyScore: 50,
  shareEnabled: true,
  privacyText: 'privacy',
  visual: {
    characterId: 'c1',
    characterName: 'Sakin',
    personaFamilyId: 'balanced_calm',
    topicLabel: 'general',
    atmosphereLabel: 'calm',
    emotionLabel: 'steady',
    prompt: 'prompt',
    negativePrompt: 'neg',
    stylePreset: 'eza_mirror_professional_v1',
    seedHint: 'seed',
  },
};

describe('mergeDailyCardSceneVisual', () => {
  it('merges scene fields into existing visual', () => {
    const merged = mergeDailyCardSceneVisual(
      baseCard,
      'https://example.com/scene.png',
      'ready'
    );
    expect(merged.visual?.sceneImageUrl).toBe('https://example.com/scene.png');
    expect(merged.visual?.sceneImageStatus).toBe('ready');
    expect(merged.visual?.prompt).toBe(baseCard.visual?.prompt);
  });

  it('leaves card unchanged when idle and no visual patch needed', () => {
    const sparse = { ...baseCard, visual: undefined };
    const merged = mergeDailyCardSceneVisual(sparse, null, 'idle');
    expect(merged).toEqual(sparse);
  });
});
