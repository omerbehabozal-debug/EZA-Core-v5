import { describe, it, expect } from 'vitest';
import {
  alignMasterPosterText,
  SUBTOPIC_ALIGNED_HEADLINE,
  SUBTOPIC_HEADLINE_CONFIDENCE_MIN,
  sanitizePosterFragment,
} from '@/lib/eza/mirror/narrativeAlignmentEngine';
import { resolveSceneSubtopics } from '@/lib/eza/mirror/sceneSubtopicResolver';
import { buildMasterPosterText } from '@/lib/eza/mirror/buildMasterPosterText';
import {
  MASTER_POSTER_HEADLINE_MAX,
  MASTER_POSTER_QUOTE_MAX,
} from '@/lib/eza/mirror/sceneSubtopicTypes';

describe('alignMasterPosterText — subtopic priority over narrative', () => {
  it('ignores generic dailyJourney when subtopic confidence is high', () => {
    const subtopic = resolveSceneSubtopics('travel', ['özbekistan', 'semerkant', 'buhara']);
    const result = alignMasterPosterText({
      dailyJourney: 'İç Yolculuk',
      headline: 'İç Yolculuk',
      quote: 'Sessiz bir yolculuk hissi.',
      sceneSubtopicResolution: subtopic,
      storyTopicResolution: { primaryTopic: 'travel', confidence: 0.9, cueTokens: [], source: 'cues' },
    });
    expect(subtopic.confidence).toBeGreaterThan(SUBTOPIC_HEADLINE_CONFIDENCE_MIN);
    expect(result.headline).toBe('İpek Yolu Sohbeti');
    expect(result.headline).not.toBe('İç Yolculuk');
  });

  it('uses subtopic-aligned quote, not raw narrative quote', () => {
    const subtopic = resolveSceneSubtopics('vehicle', ['bmw', 'mercedes', 'konfor', 'vs']);
    const result = alignMasterPosterText({
      quote: 'Hangisi daha konforlu acaba?',
      sceneSubtopicResolution: subtopic,
      storyTopicResolution: { primaryTopic: 'vehicle', confidence: 0.9, cueTokens: [], source: 'cues' },
    });
    expect(result.headline).toBe('Konfor Karşılaştırması');
    expect(result.quote).toContain('Konfor');
    expect(result.quote).not.toContain('acaba');
  });
});

describe('QA headline targets', () => {
  it('Özbekistan → İpek Yolu Sohbeti', () => {
    const subtopic = resolveSceneSubtopics('travel', ['özbekistan']);
    const master = buildMasterPosterText({
      dailyJourney: 'İç Yolculuk',
      sceneSubtopicResolution: subtopic,
      storyTopicResolution: { primaryTopic: 'travel', confidence: 0.85, cueTokens: [], source: 'cues' },
    });
    expect(master.headline).toBe('İpek Yolu Sohbeti');
  });

  it('BMW/Mercedes → Konfor Karşılaştırması', () => {
    const subtopic = resolveSceneSubtopics('vehicle', ['bmw', 'mercedes', 'konfor', 'hangisi', 'vs']);
    const master = buildMasterPosterText({
      dailyJourney: 'Karar Anı',
      sceneSubtopicResolution: subtopic,
      storyTopicResolution: { primaryTopic: 'vehicle', confidence: 0.85, cueTokens: [], source: 'cues' },
    });
    expect(master.headline).toBe('Konfor Karşılaştırması');
  });

  it('EZA MVP → Ürünün Eşiğinde', () => {
    const subtopic = resolveSceneSubtopics('technology_ai', ['eza', 'cursor', 'roadmap', 'mvp']);
    expect(subtopic.primarySubtopic).toBe('tech_product_building');
    const master = buildMasterPosterText({
      dailyJourney: 'Büyük Resim',
      sceneSubtopicResolution: subtopic,
      storyTopicResolution: {
        primaryTopic: 'technology_ai',
        confidence: 0.85,
        cueTokens: [],
        source: 'cues',
      },
    });
    expect(master.headline).toBe('Ürünün Eşiğinde');
  });
});

describe('subtopic headline registry examples', () => {
  const cases: Array<[string, string]> = [
    ['travel_samarkand', "Registan'ın Gölgesinde"],
    ['travel_bukhara', 'Buhara Akşamı'],
    ['vehicle_suv_comparison', 'Yüksekten Bakış'],
    ['arch_mosque_heritage', 'Kubbelerin Hafızası'],
    ['arch_facade_restoration', 'Taşın Hafızası'],
    ['tech_coding_ai', 'Kod ve Fikir'],
    ['tech_startup_strategy', 'Büyük Resim'],
  ];

  for (const [id, headline] of cases) {
    it(`${id} → ${headline}`, () => {
      expect(SUBTOPIC_ALIGNED_HEADLINE[id as keyof typeof SUBTOPIC_ALIGNED_HEADLINE]).toBe(
        headline
      );
      expect(headline.length).toBeLessThanOrEqual(MASTER_POSTER_HEADLINE_MAX);
    });
  }
});

describe('sanitizePosterFragment', () => {
  it('strips phone and email leakage', () => {
    expect(sanitizePosterFragment('Ara +90 532 000 00 00', MASTER_POSTER_HEADLINE_MAX)).not.toMatch(
      /532/
    );
    expect(sanitizePosterFragment('mail@test.com not', MASTER_POSTER_HEADLINE_MAX)).not.toMatch(
      /@/
    );
  });

  it('rejects raw chat fragments', () => {
    expect(sanitizePosterFragment('ne yiyebilirim sordun', MASTER_POSTER_QUOTE_MAX)).toBe('');
  });

  it('enforces max lengths', () => {
    const longHeadline = 'A'.repeat(40);
    expect(sanitizePosterFragment(longHeadline, MASTER_POSTER_HEADLINE_MAX).length).toBeLessThanOrEqual(
      MASTER_POSTER_HEADLINE_MAX
    );
  });
});
