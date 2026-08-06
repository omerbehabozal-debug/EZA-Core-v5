import { describe, expect, it } from 'vitest';
import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { resolveMirrorPublicPreview } from '@/lib/eza/mirror-share/resolveMirrorPublicPreview';

function baseCard(overrides: Partial<DailyMirrorCardModel> = {}): DailyMirrorCardModel {
  return {
    date: '2026-08-06',
    dayLabel: '6 Ağustos',
    headline: 'İki yol, bir karar',
    characterName: 'Karar Veren',
    personaFamilyId: 'decision_direction',
    shortInsight: 'Seçenekleri yan yana koydun.',
    userLine: '',
    aiLine: '',
    balanceLine: '',
    signalLevel: 'orta',
    confidence: 'yüksek',
    energyLabel: 'odak',
    energyScore: 72,
    shareEnabled: true,
    privacyText: '',
    storyTensionSummary: 'BMW X3 ile Mercedes GLC arasında kaldın.',
    visual: {
      characterId: 'x',
      characterName: 'x',
      personaFamilyId: 'decision_direction',
      topicLabel: 'vehicle',
      atmosphereLabel: 'garage',
      emotionLabel: 'focus',
      prompt: 'test',
      negativePrompt: '',
      stylePreset: 'editorial',
      seedHint: '1',
      sceneImageUrl: 'https://example.com/scene.jpg',
    },
    ...overrides,
  };
}

describe('resolveMirrorPublicPreview', () => {
  it('falls back to card headline and story tension when publish bundle unavailable', () => {
    const preview = resolveMirrorPublicPreview(baseCard(), null);
    expect(preview.title).toBe('İki yol, bir karar');
    expect(preview.summary).toContain('BMW X3');
    expect(preview.sceneImageUrl).toBe('https://example.com/scene.jpg');
  });

  it('prefers explicit scene url argument', () => {
    const preview = resolveMirrorPublicPreview(baseCard(), 'https://cdn.example/live.png');
    expect(preview.sceneImageUrl).toBe('https://cdn.example/live.png');
  });
});
