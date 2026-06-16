import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { buildMirrorV2ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import { buildMirrorStateV2 } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorStateV2';
import { buildVisualPayloadFromMirrorV2 } from '@/lib/eza/mirror/conversationMirrorV2/visualPayloadAdapter';
import { assessMirrorSafetyLevel } from '@/lib/eza/mirror/conversationMirrorV2/safetyFilter';
import { resolveActiveSeason } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';
import { buildConversationMirrorState } from '@/lib/eza/mirror/buildConversationMirrorState';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';
import {
  extractConversationCandidateTopics,
  resolveActiveConversationTopics,
  selectWeightedConversationTopic,
} from '@/lib/eza/mirror/conversationMirrorV2/conversationTopicSelection';
import {
  TOOTHPASTE_CONVERSATION_ID,
  buildToothpasteMirrorEntries,
} from '@/lib/eza/mirror/conversationMirrorV2/toothpasteConversationFixture';
import { isDentalPersonalCarePayload } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';

function makeEntry(id: string, hints?: string[]): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt: new Date().toISOString(),
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

function makeConversationEntries(
  conversationId: string,
  hintsPerTurn: string[][],
  options?: { scores?: number[] }
): SavedBehavioralEntry[] {
  return hintsPerTurn.map((hints, index) => {
    const score = options?.scores?.[index] ?? 72 + index * 4;
    return {
      ...makeEntry(`${conversationId}-${index + 1}`, hints),
      savedAt: `2026-05-31T10:0${index}:00.000Z`,
      vector: {
        ...makeEntry(`${conversationId}-${index + 1}`).vector,
        alignment_score: score,
        eza_final: score,
      },
    };
  });
}

describe('conversationMirrorV2', () => {
  it('resolves weekly season profile', () => {
    const season = resolveActiveSeason(new Date('2026-06-16'));
    expect(season.id).toBeTruthy();
    expect(season.promptBlock).toContain('Season art direction');
  });

  it('Test 1 — single-topic conversation selects vehicle comparison', () => {
    const entries = makeConversationEntries(
      'chat-bmw-single',
      [
        ['bmw', 'mercedes', 'karşılaştır'],
        ['bmw', 'sedan', 'konfor'],
        ['mercedes', 'uzun yol'],
        ['bmw', 'tercih'],
        ['karşılaştır', 'sedan'],
      ],
      { scores: [80, 82, 84, 86, 88] }
    );

    const resolution = resolveActiveConversationTopics(entries, 'bmw-single');
    expect(resolution.selectedTopic).toBe('BMW vs Mercedes');
    expect(resolution.candidateTopics.every((c) => c.source === 'active_conversation')).toBe(true);
    expect(resolution.candidateTopics.some((c) => /japonya|baklava|cephe/i.test(c.topic))).toBe(
      false
    );

    const payload = buildMirrorPayload(entries, {
      seed: 'bmw-single',
      conversationId: 'chat-bmw-single',
    });
    expect(payload.selectedTopic).toBe('BMW vs Mercedes');
    expect(payload.mirrorTitle).toBe('Sessiz Karşılaştırmalar');
    expect(payload.candidateTopics[0]?.messageCount).toBeGreaterThan(0);
    expect(payload.candidateTopics[0]?.depthScore).toBeGreaterThan(0);
  });

  it('Test 2 — multi-topic conversation picks among in-thread topics only', () => {
    const entries = makeConversationEntries('chat-desserts', [
      ['cephe', 'malzeme', 'mimari'],
      ['baklava', 'tarif'],
      ['baklava', 'tarif', 'mutfak'],
      ['sütlaç', 'tarif'],
      ['sütlaç', 'mutfak'],
    ]);

    const candidates = extractConversationCandidateTopics(entries);
    const topicLabels = candidates.map((c) => c.topic);

    expect(topicLabels).toContain('Cephe malzeme bilgisi');
    expect(topicLabels).toContain('Baklava tarifi');
    expect(topicLabels).toContain('Sütlaç tarifi');
    expect(candidates.every((c) => c.source === 'active_conversation')).toBe(true);
    expect(candidates.every((c) => (c.messageCount ?? 0) > 0)).toBe(true);
    expect(candidates.every((c) => (c.depthScore ?? 0) > 0)).toBe(true);

    const resolution = resolveActiveConversationTopics(entries, 'dessert-thread');
    expect(['Baklava tarifi', 'Sütlaç tarifi', 'Cephe malzeme bilgisi']).toContain(
      resolution.selectedTopic
    );

    const payload = buildMirrorPayload(entries, {
      seed: 'dessert-thread',
      conversationId: 'chat-desserts',
    });
    expect(payload.candidateTopics.some((c) => /bmw|sağlık/i.test(c.topic))).toBe(false);

    if (payload.selectedTopic === 'Baklava tarifi') {
      expect(payload.mirrorTitle).toBe('Tatlı Bir Gelenek');
      expect(payload.visualKeywords).toContain('baklava');
    }
  });

  it('Test 3 — same day three separate conversations stay isolated', () => {
    const dessertEntries = makeConversationEntries('chat-a', [
      ['baklava', 'tarif'],
      ['sütlaç', 'tarif'],
      ['tarif', 'mutfak'],
    ]);
    const healthEntries = makeConversationEntries('chat-b', [
      ['sağlık', 'beslenme'],
      ['yürüyüş', 'beslenme'],
      ['sağlık'],
    ]);
    const carEntries = makeConversationEntries('chat-c', [
      ['bmw', 'mercedes'],
      ['sedan', 'karşılaştır'],
      ['konfor'],
    ]);

    const dessertPayload = buildMirrorPayload(dessertEntries, {
      seed: 'day-a',
      conversationId: 'chat-a',
    });
    const healthPayload = buildMirrorPayload(healthEntries, {
      seed: 'day-b',
      conversationId: 'chat-b',
    });
    const carPayload = buildMirrorPayload(carEntries, {
      seed: 'day-c',
      conversationId: 'chat-c',
    });

    expect(dessertPayload.selectedTopic.toLowerCase()).toMatch(/baklava|sütlaç|tarif/);
    expect(healthPayload.selectedTopic.toLowerCase()).toMatch(/sağlık|beslenme|yürüyüş/);
    expect(carPayload.selectedTopic).toBe('BMW vs Mercedes');

    expect(dessertPayload.candidateTopics.some((c) => /bmw|sağlık/i.test(c.topic))).toBe(false);
    expect(healthPayload.candidateTopics.some((c) => /baklava|bmw/i.test(c.topic))).toBe(false);
    expect(carPayload.candidateTopics.some((c) => /baklava|sağlık/i.test(c.topic))).toBe(false);
  });

  it('Test 4 — prompt encodes SAINA contract and active conversation scope', () => {
    const entries = makeConversationEntries('chat-prompt', [
      ['baklava', 'tarif'],
      ['baklava', 'tarif'],
      ['sütlaç', 'tarif'],
    ]);
    const payload = buildMirrorPayload(entries, {
      seed: 'prompt-scope',
      conversationId: 'chat-prompt',
      season: 'bright_cinematic',
    });
    const prompt = buildMirrorV2ImagePrompt(payload);

    expect(prompt).toContain('1080x1350');
    expect(prompt.toLowerCase()).toContain('active conversation thread');
    expect(prompt.toLowerCase()).toContain('forbidden');
    expect(prompt).toContain(payload.mirrorTitle);
    expect(prompt.toLowerCase()).toContain('leave clean empty space at the top-left');
    expect(prompt.toLowerCase()).toContain('leave clean empty space at the top-right');
    expect(prompt.toLowerCase()).toContain('do not generate the saina logo');
    expect(prompt.toLowerCase()).toContain('do not generate any date');
    expect(prompt.toLowerCase()).toContain('charts');
    expect(prompt.toLowerCase()).toContain('dashboard');
    expect(prompt).toContain(payload.mirrorTitle);
    expect(prompt).toContain(payload.sceneMetaphor);
  });

  it('weighted selection is deterministic for the same seed', () => {
    const entries = makeConversationEntries('chat-deterministic', [
      ['cephe', 'malzeme'],
      ['baklava', 'tarif'],
      ['sütlaç', 'tarif'],
    ]);
    const first = selectWeightedConversationTopic(
      extractConversationCandidateTopics(entries),
      'stable-seed'
    );
    const second = selectWeightedConversationTopic(
      extractConversationCandidateTopics(entries),
      'stable-seed'
    );
    expect(first?.topic).toBe(second?.topic);
  });

  it('builds travel-themed payload from japan cues', () => {
    const entries = [
      makeEntry('1', ['japonya', 'tokyo', 'seyahat']),
      makeEntry('2', ['kyoto', 'rota']),
      makeEntry('3', ['keşif']),
    ];
    const payload = buildMirrorPayload(entries, {
      seed: 'japan-test',
      conversationId: 'chat-japan',
    });
    expect(payload.selectedTopic).toBe('Japonya seyahati');
    expect(payload.candidateTopics.every((c) => c.source === 'active_conversation')).toBe(true);
  });

  it('maps payload to V1-compatible visual payload', () => {
    const entries = [makeEntry('1'), makeEntry('2'), makeEntry('3')];
    const payload = buildMirrorPayload(entries, {
      seed: 'visual-test',
      conversationId: 'chat-visual',
    });
    const visual = buildVisualPayloadFromMirrorV2(payload);
    expect(visual.prompt.length).toBeGreaterThan(200);
    expect(visual.renderMode).toBe('hybrid_middle');
    expect(visual.hybridTextPayload?.headline).toBe(payload.mirrorTitle);
  });

  it('buildMirrorStateV2 satisfies share contract with enough samples', () => {
    const entries = Array.from({ length: MIRROR_MIN_SAMPLES }, (_, i) =>
      makeEntry(`e-${i}`, ['bmw', 'mercedes', 'luxury'])
    );
    const state = buildMirrorStateV2(entries, {
      seed: 'vehicle-test',
      conversationId: 'chat-bmw',
    });
    expect(state.meta.pipelineVersion).toBe('v2');
    expect(state.dailyMirrorCard.mirrorV2Payload?.conversationId).toBe('chat-bmw');
  });

  it('flags restricted safety for harmful cues', () => {
    const entries = [makeEntry('1', ['şiddet', 'kavga'])];
    expect(assessMirrorSafetyLevel(entries)).toBe('restricted');
  });

  it('exposes 11 QA lab scenarios with valid payloads', () => {
    expect(MIRROR_V2_QA_SCENARIOS).toHaveLength(11);
    for (const scenario of MIRROR_V2_QA_SCENARIOS) {
      const payload = buildMirrorPayload(scenario.buildEntries(), {
        seed: `qa-${scenario.id}`,
        season: scenario.season,
        conversationId:
          scenario.id === 'toothpaste-choice'
            ? TOOTHPASTE_CONVERSATION_ID
            : `qa-${scenario.id}`,
      });
      expect(payload.mirrorTitle.length).toBeGreaterThan(2);
      expect(payload.selectedTopic.length).toBeGreaterThan(1);
    }
  });

  it('toothpaste conversation — payload, topic extraction, and OpenAI prompt', () => {
    const entries = buildToothpasteMirrorEntries();
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const resolution = resolveActiveConversationTopics(entries, 'toothpaste-demo');
    const topicLabels = resolution.candidateTopics.map((c) => c.topic);

    expect(topicLabels).toContain('Diş macunu seçimi');
    expect(topicLabels).toContain('Hassas dişler');
    expect(topicLabels).toContain('Beyazlatıcı diş macunu');
    expect(topicLabels).toContain('Florürlü diş macunu');
    expect(resolution.candidateTopics.every((c) => c.source === 'active_conversation')).toBe(
      true
    );
    expect(['Diş macunu seçimi', 'Hassas dişler', 'Beyazlatıcı diş macunu', 'Florürlü diş macunu']).toContain(
      resolution.selectedTopic
    );

    const payload = buildMirrorPayload(entries, {
      seed: 'toothpaste-demo',
      conversationId: TOOTHPASTE_CONVERSATION_ID,
      season: 'bright_cinematic',
    });

    expect(payload.conversationId).toBe('demo-toothpaste-thread');
    expect(payload.safetyLevel).toBe('normal');
    if (payload.selectedTopic === 'Diş macunu seçimi') {
      expect(payload.mirrorTitle).toBe('Temiz Bir Seçim');
      expect(payload.topicSummary).toContain('florür');
      expect(payload.emotionalTone).toBe('careful');
    }
    expect(isDentalPersonalCarePayload(payload)).toBe(true);

    const prompt = buildMirrorV2ImagePrompt(payload);
    expect(prompt.toLowerCase()).toContain('active conversation thread');
    expect(prompt).toContain(payload.mirrorTitle);
    expect(prompt.toLowerCase()).toContain('leave clean empty space at the top-left');
    expect(prompt.toLowerCase()).toContain('leave clean empty space at the top-right');
    expect(prompt.toLowerCase()).toContain('do not generate the saina logo');
    expect(prompt.toLowerCase()).toContain('do not generate any date');
    expect(prompt.toLowerCase()).toContain('bugün görünen desen');
    expect(prompt.toLowerCase()).toContain('coaching');
    expect(prompt.toLowerCase()).toContain('dashboard');
    expect(prompt.toLowerCase()).toContain('personal-care scene direction');
    expect(prompt.toLowerCase()).toContain('before-after');
    expect(prompt.toLowerCase()).toContain('product-ad hero');
  });
});
