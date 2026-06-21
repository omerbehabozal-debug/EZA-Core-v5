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
import { resolveTopicShotMode } from '@/lib/eza/mirror/conversationMirrorV3/shotDirectorV43';
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
    expect(payload.mirrorTitle).not.toMatch(/Kyoto|Gion|Japonya/i);
    expect(payload.mirrorTitle).toMatch(/Fener|Gece|Sokak|Rota/i);
    expect(payload.mirrorText).not.toMatch(/şafak sisi|iç sesinde|ufuk açılıyor/i);
    expect(payload.closingLine).toBeUndefined();
    expect(payload.sceneComposition.sceneMetaphor).not.toMatch(/golden horizon|vast golden|atmospheric depth/i);
  });

  it('V4 mirror copy is topic-visible and not poetic emotion fallback', () => {
    const scenarios = ['japan-travel', 'architecture-facade', 'toothpaste-choice'] as const;
    for (const id of scenarios) {
      const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === id)!;
      const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
        seed: `qa-v4-${id}`,
        conversationId: `qa-v4-${id}`,
      });

      expect(hasConversationSummaryLanguage(payload.mirrorText)).toBe(false);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bbugün\b/);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bkonuştun\b/);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bkonuşman\b/);
      expect(payload.mirrorText.toLowerCase()).not.toMatch(/\bsohbet\b/);
      expect(payload.mirrorText).not.toMatch(/şafak sisi|iç sesinde|ufuk açılıyor/i);
      expect(payload.closingLine).toBeUndefined();
    }
  });

  it('japan V4 copy uses editorial observation, not evidence inventory', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v4-japan-fixed',
      conversationId: 'qa-v4-japan',
    });

    expect(payload.mirrorText.toLowerCase()).not.toMatch(/keşif|tren bileti|rota notları|fenerli sokaklar/);
    expect(payload.mirrorTitle).not.toMatch(/Kyoto|Gion|Japonya/i);
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

  it('V4.5 prompt excludes evidence bullet lists and uses fusion + world layer', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v44-arch',
      conversationId: 'qa-v44-arch',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(prompt).toContain('conversation poster');
    expect(prompt).toContain('Evidence fusion scene');
    expect(prompt).toContain('World Layer:');
    expect(prompt).not.toContain('Conversation evidence (20%)');
    expect(prompt).not.toContain('Supporting evidence');
    expect(prompt).not.toContain('Narrative distance:');
    expect(prompt).not.toContain('Meaning:');
    expect(prompt).not.toContain('Emotion:');
    expect(containsForbiddenMirrorPhrase(payload.mirrorTitle)).toBe(false);
    expect(hasConversationSummaryLanguage(payload.mirrorText)).toBe(false);
  });

  it('V4.5 prompt includes fusion scene and world layer', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v44-japan',
      conversationId: 'qa-v44-japan',
      season: 'golden_hour',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
    expect(payload.sceneComposition.evidenceFusionScene.length).toBeGreaterThan(40);
    expect(prompt).toContain('World Layer:');
    expect(prompt).toContain('Unified frame rule:');
    expect(prompt).toContain('Poster test:');
    expect(prompt).toContain('Typography (10%)');
    expect(prompt).toContain('Visual style:');
    expect(prompt).toContain('Shot:');
    expect(prompt).toContain('Lighting:');
    expect(prompt.indexOf('Evidence fusion scene')).toBeLessThan(prompt.indexOf('Visual style:'));
  });

  it('V4.3 prompt uses topic-aware shot mode (not seed rotation)', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
      seed: 'qa-v43-japan-shot',
      conversationId: 'qa-v43-japan-shot',
    });
    const prompt = buildMirrorV3ImagePrompt(payload);

    expect(payload.storyTopicId).toBe('travel');
    expect(prompt).toContain('Shot: documentary_wide');
    expect(prompt).not.toContain('macro_material');
  });

  it('V4.3 shot mode is topic-aware per conversation topic', () => {
    const japan = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const japanPayload = buildMirrorPayloadV3(japan.buildEntries(), {
      seed: 'conv-a:v43',
      conversationId: 'conv-a:v43',
    });
    const bmw = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'bmw-mercedes')!;
    const bmwPayload = buildMirrorPayloadV3(bmw.buildEntries(), {
      seed: 'conv-a:v43',
      conversationId: 'conv-a:v43',
    });

    const japanShot = resolveTopicShotMode({
      storyTopicId: japanPayload.storyTopicId,
      evidence: japanPayload.conversationEvidence,
      selectedTopic: japanPayload.selectedTopic,
    });
    const bmwShot = resolveTopicShotMode({
      storyTopicId: bmwPayload.storyTopicId,
      evidence: bmwPayload.conversationEvidence,
      selectedTopic: bmwPayload.selectedTopic,
    });

    expect(japanShot.mode).toBe('documentary_wide');
    expect(japanShot.source).toBe('topic-aware');
    expect(bmwShot.mode).toBe('cinematic_garage');
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
    expect(state.dailyMirrorCard.visual?.prompt).toContain('Evidence fusion scene');
    expect(state.dailyMirrorCard.visual?.prompt).toContain('Poster test:');
    expect(state.dailyMirrorCard.visual?.prompt).not.toContain('Bugün Japonya');
  });

  it('brand signature matches spec', () => {
    expect(MIRROR_V3_BRAND_SIGNATURE.line1).toBe('SAINA');
    expect(MIRROR_V3_BRAND_SIGNATURE.line2).toBe(
      'İlişkiyi dinler, deseni zamanla görür.'
    );
  });
});
