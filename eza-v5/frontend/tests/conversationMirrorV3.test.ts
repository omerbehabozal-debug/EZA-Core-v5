import { describe, expect, it } from 'vitest';
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import { buildMirrorStateV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorStateV3';
import { buildConversationMirrorState } from '@/lib/eza/mirror/buildConversationMirrorState';
import { containsForbiddenMirrorPhrase } from '@/lib/eza/mirror/conversationMirrorV3/forbiddenLexicon';
import {
  hasConversationSummaryLanguage,
  containsDirectTopicReference,
  sanitizeNarrativeMirrorCopy,
  extractTopicTokens,
} from '@/lib/eza/mirror/conversationMirrorV3/narrativeCopySanitizer';
import { resolveNarrativeDistance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
import { resolveShotMode } from '@/lib/eza/mirror/conversationMirrorV3/artDirectionV32';
import {
  MIRROR_REFINEMENT_VERSION,
  MIRROR_V3_BRAND_SIGNATURE,
  MIRROR_V3_SCENE_CACHE_KEY,
} from '@/lib/eza/mirror/conversationMirrorV3/types';
import { buildMirrorV3IntentFingerprint } from '@/lib/eza/mirror/conversationMirrorV3/sceneCacheFingerprint';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';

describe('conversationMirrorV3', () => {
  it('payload includes narrative layer fields', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v3-japan',
      conversationId: 'qa-v3-japan',
      season: 'golden_hour',
    });

    expect(payload.pipelineVersion).toBe('v3');
    expect(payload.refinementVersion).toBe(MIRROR_REFINEMENT_VERSION);
    expect(payload.narrativeTheme).toBeTruthy();
    expect(payload.meaning).toBeTruthy();
    expect(payload.emotionalAtmosphere).toBeTruthy();
    expect(payload.narrativeDistance).toBeGreaterThanOrEqual(2);
    expect(payload.narrativeDistance).toBeLessThanOrEqual(3);
    expect(payload.visiblePattern).toBeUndefined();
    expect(payload.mirrorTitle).toBe('Uzak Doğuda Yeni Bir Bakış');
  });

  it('V3.1 mirror copy has no conversation summary or direct topic references', () => {
    const scenarios = ['japan-travel', 'architecture-facade', 'toothpaste-choice'] as const;
    for (const id of scenarios) {
      const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === id)!;
      const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
        seed: `qa-v31-${id}`,
        conversationId: `qa-v31-${id}`,
      });
      const tokens = extractTopicTokens(payload.selectedTopic, payload.topic);

      expect(hasConversationSummaryLanguage(payload.mirrorText)).toBe(false);
      expect(containsDirectTopicReference(payload.mirrorText, tokens)).toBe(false);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bbugün\b/);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bkonuştun\b/);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bkonuşman\b/);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bsohbet\b/);
    }
  });

  it('japan V3.1 copy describes meaning without naming Japan', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v31-japan-fixed',
      conversationId: 'qa-v31-japan',
    });

    expect(payload.mirrorText.toLowerCase()).not.toContain('japonya');
    expect(payload.mirrorText.toLowerCase()).not.toContain('japan');
    expect(payload.mirrorText.length).toBeGreaterThan(20);
  });

  it('narrative distance resolves to level 2 or 3', () => {
    const d2 = resolveNarrativeDistance('seed-distance-2');
    const d3 = resolveNarrativeDistance('seed-distance-3-alt');
    expect([2, 3]).toContain(d2.level);
    expect([2, 3]).toContain(d3.level);
    expect(d2.label).toBeTruthy();
    expect(d2.sceneGuidance).toBeTruthy();
  });

  it('sanitizer rejects conversation-summary phrases', () => {
    expect(
      sanitizeNarrativeMirrorCopy("Bugün Japonya'yı konuştun. Harika bir sohbetti.")
    ).toBe('');
    expect(
      hasConversationSummaryLanguage('You talked about architecture today')
    ).toBe(true);
    expect(
      hasConversationSummaryLanguage('Uzak bir ufuk açılıyor; merak büyüyor.')
    ).toBe(false);
  });

  it('prompt contract includes narrative distance and forbids summary language', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v3-arch',
      conversationId: 'qa-v3-arch',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(prompt).toContain('Narrative distance:');
    expect(prompt).toContain('scene direction');
    expect(prompt).toContain('Conversation evidence:');
    expect(prompt).toContain('Meaning:');
    expect(prompt).toContain('Emotion:');
    expect(prompt.toLowerCase()).toContain('not a summary');
    expect(prompt.toLowerCase()).toContain('bugün konuştun');
    expect(containsForbiddenMirrorPhrase(payload.mirrorTitle)).toBe(false);
    expect(hasConversationSummaryLanguage(payload.mirrorText)).toBe(false);
  });

  it('V3.3 prompt includes evidence layer, cinematography, and typography director', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v33-japan',
      conversationId: 'qa-v33-japan',
      season: 'golden_hour',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
    expect(prompt).toContain('Conversation evidence:');
    expect(prompt).toContain('Topic visibility rule:');
    expect(prompt).toContain('Typography director:');
    expect(prompt).toContain('Cinematography contract:');
    expect(prompt).toContain('Lighting recipe:');
    expect(prompt).toContain('Shot mode (');
    expect(prompt).toContain('Reference tier:');
    expect(prompt.indexOf('Conversation evidence:')).toBeLessThan(
      prompt.indexOf('Cinematography contract:')
    );
    expect(prompt.indexOf('Typography director:')).toBeLessThan(
      prompt.indexOf('Brand safe zones')
    );
  });

  it('V3.2 shot mode is deterministic per conversation seed', () => {
    const a = resolveShotMode('conv-a:v32');
    const b = resolveShotMode('conv-a:v32');
    const c = resolveShotMode('conv-b:v32');
    expect(a.mode).toBe(b.mode);
    expect(a.description).toBe(b.description);
    expect(typeof c.mode).toBe('string');
  });

  it('buildConversationMirrorState routes to V3 pipeline', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS[0]!;
    const state = buildConversationMirrorState(scenario.buildEntries(), {
      pipelineVersion: 'v3',
      conversationId: 'qa-v3-route',
    });

    expect(state.meta.pipelineVersion).toBe('v3');
    expect(state.dailyMirrorCard.mirrorPipelineVersion).toBe('v3');
    expect(state.dailyMirrorCard.mirrorV3Payload?.refinementVersion).toBe(MIRROR_REFINEMENT_VERSION);
    expect(state.dailyMirrorCard.energyScore).toBeNull();
    expect(state.dailyMirrorCard.characterName).toBe('SAINA');
  });

  it('V3 state card has no coaching energy labels', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const state = buildMirrorStateV3(scenario.buildEntries(), {
      conversationId: 'qa-v3-japan-state',
      seed: 'qa-v3-japan-state',
    });
    const card = state.dailyMirrorCard;

    expect(card.energyLabel).toBe('');
    expect(card.balanceLine).toBe('');
    expect(card.visual?.stylePreset).toMatch(/^eza_mirror_professional/);
    expect(hasConversationSummaryLanguage(card.shortInsight)).toBe(false);
  });

  it('V3.1 scene cache key busts stale V3 posters', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v31-cache',
      conversationId: 'qa-v31-cache',
    });

    const fingerprint = buildMirrorV3IntentFingerprint(payload);
    expect(fingerprint.startsWith(MIRROR_V3_SCENE_CACHE_KEY)).toBe(true);

    const state = buildMirrorStateV3(scenario.buildEntries(), {
      conversationId: 'qa-v31-cache',
      seed: 'qa-v31-cache',
    });
    const visual = state.dailyMirrorCard.visual!;

    expect(visual.intentFingerprint).toBe(fingerprint);
    expect(visual.seedHint).toContain(MIRROR_V3_SCENE_CACHE_KEY);
    expect(visual.intentFingerprint).not.toMatch(/^v3:/);
  });

  it('conversation scope always routes to V3 regardless of pipeline override', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const state = buildConversationMirrorState(scenario.buildEntries(), {
      conversationId: 'conv-force-v3',
      pipelineVersion: 'v1',
    });

    expect(state.meta.pipelineVersion).toBe('v3');
    expect(state.dailyMirrorCard.mirrorV3Payload?.refinementVersion).toBe(MIRROR_REFINEMENT_VERSION);
    expect(hasConversationSummaryLanguage(state.dailyMirrorCard.shortInsight)).toBe(false);
  });

  it('V3 visual uses backend-accepted style preset and cache fingerprint', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const state = buildMirrorStateV3(scenario.buildEntries(), {
      conversationId: 'qa-v31-style',
      seed: 'qa-v31-style',
    });

    expect(state.dailyMirrorCard.visual?.stylePreset).toBe('eza_mirror_professional_v1');
    expect(state.dailyMirrorCard.visual?.intentFingerprint).toContain(
      MIRROR_V3_SCENE_CACHE_KEY
    );
    expect(state.dailyMirrorCard.visual?.prompt).toContain('Narrative distance:');
    expect(state.dailyMirrorCard.visual?.prompt).toContain('Cinematography contract:');
    expect(state.dailyMirrorCard.visual?.prompt).not.toContain('Bugün Japonya');
  });

  it('brand signature matches spec', () => {
    expect(MIRROR_V3_BRAND_SIGNATURE.line1).toBe('SAINA');
    expect(MIRROR_V3_BRAND_SIGNATURE.line2).toBe(
      'İlişkiyi dinler, deseni zamanla görür.'
    );
  });
});
