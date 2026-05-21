import { describe, it, expect } from 'vitest';
import { buildContextualHighlight } from '@/lib/eza/mirror/contextualHighlight';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const baseCard: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: '21 Mayıs',
  headline: 'Test',
  characterName: 'Yolcu',
  personaFamilyId: 'decision_direction',
  shortInsight: 'Insight',
  userLine: 'Seçenekleri tarttın.',
  aiLine: 'Kıyas çerçevesi sundu.',
  balanceLine: 'Sakin ritim.',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'Dengede',
  energyScore: 72,
  shareEnabled: true,
  privacyText: 'privacy',
  storyTopicKey: 'finance',
  storyVariant: 'compare',
  visual: {
    characterId: 'decision_direction',
    characterName: 'Yolcu',
    personaFamilyId: 'decision_direction',
    topicLabel: 'finans ve planlama',
    atmosphereLabel: 'calm',
    emotionLabel: 'calm',
    prompt: 'test',
    negativePrompt: 'test',
    stylePreset: 'eza_mirror_professional_v1',
    seedHint: 'seed',
    sceneIntentLabel: 'premium car comparison',
  },
};

describe('contextualHighlight', () => {
  it('maps premium car comparison intent to dual VS band', () => {
    const h = buildContextualHighlight(baseCard);
    expect(h.kind).toBe('dual_comparison');
    expect(h.centerBadge).toBe('VS');
    expect(h.left?.label).toMatch(/sürüş|performans/i);
    expect(h.right?.label).toMatch(/konfor/i);
  });

  it('buildPosterCardContent includes highlight', () => {
    const c = buildPosterCardContent(baseCard);
    expect(c.contextualHighlight.bandTitle.length).toBeGreaterThan(2);
    expect(c.contextualHighlight.tags.length).toBeGreaterThan(0);
  });

  it('culinary intent uses mindful recipe tags', () => {
    const h = buildContextualHighlight({
      ...baseCard,
      storyTopicKey: 'health',
      storyVariant: 'nourish',
      visual: { ...baseCard.visual!, sceneIntentLabel: 'mindful culinary preparation' },
    });
    expect(h.bandTitle).toMatch(/Özenli|İyi/i);
  });
});
