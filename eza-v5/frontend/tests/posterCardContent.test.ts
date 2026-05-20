import { describe, it, expect } from 'vitest';
import { buildPosterCardContent } from '@/lib/eza/mirror/posterCardContent';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';

const baseCard: DailyMirrorCardModel = {
  date: '2026-05-21',
  dayLabel: '21 Mayıs 2026',
  headline: 'Test',
  characterName: 'Köprü Kurucu',
  personaFamilyId: 'sensitive_careful',
  shortInsight: 'Bugün iletişimde yumuşak adımlar attın.',
  userLine: 'Arkadaşlık hakkında sorular sordun.',
  aiLine: 'AI sakin ve açıklayıcı yanıtlar verdi.',
  balanceLine: 'Empati ve sabır öne çıkıyor.',
  signalLevel: 'low',
  confidence: 'medium',
  energyLabel: 'İyileşiyor',
  energyScore: 72,
  shareEnabled: true,
  privacyText: 'privacy',
  visual: {
    characterId: 'sensitive_careful',
    characterName: 'Köprü Kurucu',
    personaFamilyId: 'sensitive_careful',
    topicLabel: 'arkadaşlık ve ilişki',
    atmosphereLabel: 'calm',
    emotionLabel: 'steady',
    prompt: 'prompt',
    negativePrompt: 'neg',
    stylePreset: 'eza_mirror_professional_v1',
    seedHint: 'seed',
  },
};

describe('buildPosterCardContent', () => {
  it('derives friendship theme from visual topicLabel', () => {
    const c = buildPosterCardContent(baseCard);
    expect(c.themeTitle).toBe('DOSTLUK & UYUM');
    expect(c.activities.length).toBeGreaterThan(0);
    expect(c.quote.length).toBeGreaterThan(10);
    expect(c.relationshipBars).toHaveLength(3);
  });
});
