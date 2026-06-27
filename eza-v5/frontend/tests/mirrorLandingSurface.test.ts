import { describe, expect, it } from 'vitest';
import {
  assertMirrorLandingSurfaceClean,
  formatMirrorLandingDate,
  pickMirrorLandingSurface,
} from '@/lib/eza/mirror-network/landingSurface';
import type { MirrorNetworkPublicApiResponse } from '@/lib/eza/mirror-network/publicTypes';

const FULL_API_PAYLOAD: MirrorNetworkPublicApiResponse = {
  slug: 'sokak-lambalari-seed01',
  shareUrl: 'https://saina.app/m/sokak-lambalari-seed01',
  cardTitle: 'Sokak Lambaları',
  cardDate: '2026-05-31',
  sceneImageUrl: 'https://picsum.photos/seed/mirror/1080/1350',
  coreCuriosity: 'Kyoto yağmurdan sonra nasıl bir atmosfer taşır?',
  curiosityContext:
    'Bu Mirror, Kyoto\'nun akşam sokaklarında yürümenin nasıl bir his olduğunu anlamaya çalışan bir araştırmadan doğdu.',
  landingContext: 'fallback landing',
  hooks: ['Kyoto\'da bir akşam nasıl yaşanır?'],
  seedQuestions: ['İlk rota nereden başlamalı?'],
  discoverySignals: ['travel'],
  collectionTags: ['travel'],
  seed: { topicCategory: 'travel', mood: 'discovery' },
};

describe('mirror landing surface (Stage 2A)', () => {
  it('picks only landing-safe fields', () => {
    const surface = pickMirrorLandingSurface(FULL_API_PAYLOAD);
    assertMirrorLandingSurfaceClean(surface);

    expect(surface.cardTitle).toBe('Sokak Lambaları');
    expect(surface.curiosityContext).toContain('Kyoto');
    expect(surface.dayLabel).toBe('31 Mayıs 2026');
    expect(surface.sceneImageUrl).toContain('picsum');

    const keys = Object.keys(surface).sort();
    expect(keys).toEqual(
      ['cardDate', 'cardTitle', 'curiosityContext', 'dayLabel', 'sceneImageUrl', 'slug'].sort()
    );
  });

  it('does not expose coreCuriosity, hooks, or seedQuestions on surface', () => {
    const surface = pickMirrorLandingSurface(FULL_API_PAYLOAD);
    const json = JSON.stringify(surface);
    expect(json).not.toContain('coreCuriosity');
    expect(json).not.toContain('seedQuestions');
    expect(json).not.toContain('Kyoto yağmurdan sonra');
    expect(json).not.toContain('discoverySignals');
  });

  it('formats Turkish dates', () => {
    expect(formatMirrorLandingDate('2026-01-05')).toBe('5 Ocak 2026');
  });
});
