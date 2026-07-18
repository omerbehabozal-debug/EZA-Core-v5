import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildConversationMirrorEntries } from '@/lib/eza/mirror/conversationMirrorEntries';
import {
  buildConversationMeaningSummary,
  isTopicConsistentWithMeaning,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationMeaningSummary';
import { resolveActiveConversationTopics } from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicSelection';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';

function makeEntry(id: string, hints: string[], savedAtOffset = 0): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date(Date.now() + savedAtOffset).toISOString(),
    mirrorCueHints: hints,
    vector: {
      input_risk: 0.2,
      output_risk: 0.15,
      input_health: 0.8,
      output_health: 0.85,
      alignment_score: 72,
      eza_final: 84,
      intent: 'explore',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: {
      health_gap: 0.05,
      risk_delta_output_minus_input: -0.05,
      index: 0.1,
    },
  };
}

const KYOTO_TEXTS = [
  "Kyoto'da akşam yürüyüşü yapmak istiyorum.",
  'Gion tarafı mı yoksa Pontocho mu?',
  'Sokak lambaları ve dar sokaklar ilgimi çekiyor.',
  'Küçük bir kafe önerir misin?',
  'Yağmur yağarsa plan nasıl değişir?',
];

describe('conversation meaning summary (semantic-first)', () => {
  it('Kyoto rainy evening walk → travel, not health', () => {
    const meaning = buildConversationMeaningSummary({ conversationTexts: KYOTO_TEXTS });
    expect(meaning.primaryTopic).toBe('travel');
    expect(meaning.entities.join(' ')).toMatch(/Kyoto|Gion|Japonya|Pontocho/i);
    expect(meaning.confidence).toBeGreaterThanOrEqual(0.62);
  });

  it('daily step goal walk → health', () => {
    const meaning = buildConversationMeaningSummary({
      conversationTexts: [
        'Her gün 10 bin adım yürüyüş yapmaya çalışıyorum.',
        'Kalori yakmak ve kilo vermek istiyorum.',
      ],
    });
    expect(meaning.primaryTopic).toBe('health');
  });

  it('walkway width → architecture', () => {
    const meaning = buildConversationMeaningSummary({
      conversationTexts: [
        'Yürüyüş yolu genişliği nasıl projelendirilir?',
        'Kaldırım ve yaya aksı ölçülerini netleştirelim.',
      ],
    });
    expect(meaning.primaryTopic).toBe('architecture');
  });

  it('rejects health title when meaning is travel', () => {
    const meaning = buildConversationMeaningSummary({ conversationTexts: KYOTO_TEXTS });
    expect(isTopicConsistentWithMeaning('health', meaning)).toBe(false);
    expect(isTopicConsistentWithMeaning('travel', meaning)).toBe(true);
  });
});

describe('resolveActiveConversationTopics semantic authority', () => {
  it('Kyoto cues with yürüyüş still resolve travel', () => {
    const entries = [
      makeEntry('1', ['kyoto', 'yürüyüş'], 0),
      makeEntry('2', ['gion', 'yürüyüş'], 1000),
      makeEntry('3', ['yürüyüş', 'rota'], 2000),
      makeEntry('4', ['yürüyüş'], 3000),
      makeEntry('5', ['yağmur', 'yürüyüş'], 4000),
    ];
    const resolution = resolveActiveConversationTopics(entries, 'kyoto-walk', {
      conversationTexts: KYOTO_TEXTS,
    });
    expect(resolution.primaryTopic).toBe('travel');
    expect(resolution.meaning.primaryTopic).toBe('travel');
    expect(resolution.selectedTopic.toLowerCase()).not.toMatch(/sağlık|beslenme/);
  });

  it('Rome walking tour texts → travel', () => {
    const texts = [
      "Roma'yı yürüyerek gezmek istiyorum.",
      'Tarihi merkezde hangi sokaklar güzel?',
    ];
    const entries = buildConversationMirrorEntries(
      texts.flatMap((text, i) => [
        { id: `u-${i}`, text, isUser: true },
        { id: `a-${i}`, text: 'Tabii, önerilerim var.', isUser: false },
      ])
    );
    const resolution = resolveActiveConversationTopics(entries, 'rome-walk', {
      conversationTexts: texts,
    });
    expect(resolution.primaryTopic).toBe('travel');
  });

  it('10k steps → health', () => {
    const texts = ['Günde 10 bin adım yürüyüş hedefim var.', 'Kalori takibi de yapmak istiyorum.'];
    const entries = [
      makeEntry('1', ['yürüyüş', 'adım']),
      makeEntry('2', ['kalori', 'yürüyüş'], 1000),
    ];
    const resolution = resolveActiveConversationTopics(entries, 'steps-health', {
      conversationTexts: texts,
    });
    expect(resolution.primaryTopic).toBe('health');
  });

  it('V3 payload for Kyoto does not use Tezgâh Işığı health title', () => {
    const entries = [
      makeEntry('1', ['kyoto', 'yürüyüş']),
      makeEntry('2', ['gion', 'yürüyüş'], 1000),
      makeEntry('3', ['kafe', 'yürüyüş'], 2000),
      makeEntry('4', ['yağmur'], 3000),
      makeEntry('5', ['pontocho'], 4000),
    ];
    const payload = buildMirrorPayloadV3(entries, {
      conversationId: 'chat-kyoto-semantic',
      seed: 'kyoto-semantic',
      conversationTexts: KYOTO_TEXTS,
    });
    expect(payload.storyTopicId).toBe('travel');
    expect(payload.mirrorTitle).not.toMatch(/Tezgâh|Tezgah|Sabah Ritüeli/i);
  });
});
