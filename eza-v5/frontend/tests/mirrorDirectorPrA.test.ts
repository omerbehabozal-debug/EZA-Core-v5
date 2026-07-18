import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildConversationMirrorState } from '@/lib/eza/mirror/buildConversationMirrorState';
import {
  assertSnapshotHasNoPrivateKeys,
  buildMirrorConversationSnapshotPreview,
  DEFAULT_MAX_SNAPSHOT_CHARS,
  snapshotToModelInput,
} from '@/lib/eza/mirror/director/conversationSnapshotPreview';
import {
  buildHeuristicDirectorAnalysis,
  parseMirrorMeaningAnalysisJson,
  resolveMeaningAnalysisWithFallback,
} from '@/lib/eza/mirror/director/heuristicMeaningFallback';
import { MIRROR_DIRECTOR_SCHEMA_VERSION } from '@/lib/eza/mirror/director/mirrorDirectorTypes';

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

describe('conversationTexts forwarding (V3 integration)', () => {
  it('reaches buildMirrorStateV3 → payload with travel (not health title)', () => {
    const entries = [
      makeEntry('1', ['kyoto', 'yürüyüş']),
      makeEntry('2', ['gion', 'yürüyüş'], 1000),
      makeEntry('3', ['kafe', 'yürüyüş'], 2000),
      makeEntry('4', ['yağmur'], 3000),
      makeEntry('5', ['pontocho'], 4000),
    ];
    const state = buildConversationMirrorState(entries, {
      conversationId: 'chat-kyoto-forward',
      seed: 'kyoto-forward',
      conversationTexts: KYOTO_TEXTS,
    });
    const payload = state.dailyMirrorCard.mirrorV3Payload;
    expect(payload?.storyTopicId).toBe('travel');
    expect(state.dailyMirrorCard.headline).not.toMatch(/Tezgâh|Tezgah|Sabah Ritüeli/i);
  });

  it('without conversationTexts, yürüyüş-heavy cues can still drift (documents why forward matters)', () => {
    const entries = [
      makeEntry('1', ['yürüyüş']),
      makeEntry('2', ['yürüyüş'], 1000),
      makeEntry('3', ['yürüyüş'], 2000),
      makeEntry('4', ['yürüyüş'], 3000),
      makeEntry('5', ['yürüyüş'], 4000),
    ];
    // With Kyoto texts, travel wins even if cues are walk-only:
    const withTexts = buildConversationMirrorState(entries, {
      conversationId: 'chat-walk-texts',
      seed: 'walk-texts',
      conversationTexts: KYOTO_TEXTS,
    });
    expect(withTexts.dailyMirrorCard.mirrorV3Payload?.storyTopicId).toBe('travel');
  });
});

describe('heuristic Director adapter regressions', () => {
  it('Kyoto + rain + walk → travel', () => {
    const analysis = buildHeuristicDirectorAnalysis({ conversationTexts: KYOTO_TEXTS });
    expect(analysis.schemaVersion).toBe(MIRROR_DIRECTOR_SCHEMA_VERSION);
    expect(analysis.primaryTopic).toBe('travel');
    expect(analysis.topicCategory).toBe('travel');
    expect(analysis.forbiddenSymbols.join(' ')).toMatch(/bathroom|cosmetics/i);
  });

  it('Rome walking tour → travel', () => {
    const analysis = buildHeuristicDirectorAnalysis({
      conversationTexts: [
        "Roma'yı yürüyerek gezmek istiyorum.",
        'Tarihi merkezde hangi sokaklar güzel?',
      ],
    });
    expect(analysis.primaryTopic).toBe('travel');
  });

  it('10k steps + calories → health', () => {
    const analysis = buildHeuristicDirectorAnalysis({
      conversationTexts: [
        'Her gün 10 bin adım yürüyüş yapmaya çalışıyorum.',
        'Kalori yakmak ve kilo vermek istiyorum.',
      ],
    });
    expect(analysis.primaryTopic).toBe('health');
  });

  it('walkway + sidewalk → architecture', () => {
    const analysis = buildHeuristicDirectorAnalysis({
      conversationTexts: [
        'Yürüyüş yolu genişliği nasıl projelendirilir?',
        'Kaldırım ve yaya aksı ölçülerini netleştirelim.',
      ],
    });
    expect(analysis.primaryTopic).toBe('architecture');
  });
});

describe('LLM result fallback resolution', () => {
  it('invalid structured output → heuristic fallback', () => {
    const parsed = parseMirrorMeaningAnalysisJson({ primaryTopic: 'travel' });
    expect(parsed.ok).toBe(false);
    const resolved = resolveMeaningAnalysisWithFallback({
      llmResult: parsed,
      conversationTexts: KYOTO_TEXTS,
    });
    expect(resolved.source).toBe('heuristic_fallback');
    expect(resolved.storyTopicId).toBe('travel');
  });

  it('timeout/429 typed failure → heuristic fallback', () => {
    for (const code of ['timeout', 'rate_limit'] as const) {
      const resolved = resolveMeaningAnalysisWithFallback({
        llmResult: { ok: false, code, message: code, retryable: true },
        conversationTexts: KYOTO_TEXTS,
      });
      expect(resolved.source).toBe('heuristic_fallback');
      expect(resolved.storyTopicId).toBe('travel');
    }
  });

  it('low-confidence LLM conflicting with strong heuristic → deferred, heuristic active', () => {
    const resolved = resolveMeaningAnalysisWithFallback({
      llmResult: {
        ok: true,
        belowConfidenceThreshold: true,
        analysis: {
          schemaVersion: MIRROR_DIRECTOR_SCHEMA_VERSION,
          primaryTopic: 'health',
          topicCategory: 'health',
          secondaryTopics: [],
          userIntent: 'unclear walk',
          emotionalTone: [],
          narrative: 'Ambiguous walk',
          visualMotifs: [],
          forbiddenSymbols: [],
          suggestedPalette: [],
          suggestedComposition: 'path',
          confidence: 0.4,
        },
      },
      conversationTexts: KYOTO_TEXTS,
    });
    expect(resolved.deferredConflict).toBe(true);
    expect(resolved.source).toBe('heuristic_deferred_conflict');
    expect(resolved.storyTopicId).toBe('travel');
    expect(resolved.llmAnalysis?.primaryTopic).toBe('health');
  });

  it('high-confidence LLM travel is kept', () => {
    const resolved = resolveMeaningAnalysisWithFallback({
      llmResult: {
        ok: true,
        analysis: {
          schemaVersion: MIRROR_DIRECTOR_SCHEMA_VERSION,
          primaryTopic: 'travel',
          topicCategory: 'travel',
          secondaryTopics: ['Kyoto'],
          userIntent: 'rainy evening plan',
          emotionalTone: ['calm'],
          narrative: 'Rainy Kyoto evening',
          visualMotifs: ['lanterns'],
          forbiddenSymbols: ['bathroom mirror'],
          suggestedPalette: ['amber'],
          suggestedComposition: 'street scene',
          confidence: 0.95,
        },
      },
      conversationTexts: KYOTO_TEXTS,
    });
    expect(resolved.source).toBe('llm');
    expect(resolved.storyTopicId).toBe('travel');
  });
});

describe('conversation snapshot preview (non-authority)', () => {
  it('applies token/char cap and keeps head+tail users', () => {
    const users = Array.from({ length: 40 }, (_, i) => `Mesaj ${i}: ${'içerik '.repeat(20)}`);
    const snap = buildMirrorConversationSnapshotPreview({
      title: 'Kyoto',
      userMessages: users,
      maxChars: 1800,
    });
    expect(snap.charCount).toBeLessThanOrEqual(1800);
    expect(snap.truncated).toBe(true);
    expect(snap.charCount).toBeLessThanOrEqual(DEFAULT_MAX_SNAPSHOT_CHARS);
  });

  it('model input excludes private archive metadata keys', () => {
    const snap = buildMirrorConversationSnapshotPreview({
      title: 'Rainy Kyoto',
      userMessages: KYOTO_TEXTS,
    });
    const payload = snapshotToModelInput(snap);
    expect(Object.keys(payload).sort()).toEqual([
      'conversationSummary',
      'messages',
      'title',
    ]);
    assertSnapshotHasNoPrivateKeys(payload);
  });
});

describe('chat stream isolation', () => {
  it('streaming / chat inner files do not import Director service', () => {
    const directorImport = /mirror\/director|mirror_meaning_analysis|heuristicMeaningFallback/;
    const files = [
      join(process.cwd(), 'components', 'standalone', 'StandaloneChatInner.tsx'),
      join(process.cwd(), 'hooks', 'useStreamResponse.ts'),
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src).not.toMatch(directorImport);
    }
  });
});
