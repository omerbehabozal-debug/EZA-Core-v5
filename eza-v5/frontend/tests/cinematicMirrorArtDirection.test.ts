import { describe, expect, it } from 'vitest';
import {
  clampWords,
  polishMirrorPayloadCopy,
  polishMirrorText,
  sanitizeCinematicCopy,
  toEmotionalAtmosphere,
} from '@/lib/eza/mirror/conversationMirrorV2/cinematicCopyContract';
import { buildMirrorPayload } from '@/lib/eza/mirror/conversationMirrorV2/buildMirrorPayload';
import { buildMirrorV2ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV2/promptBuilder';
import { buildToothpasteMirrorEntries, TOOTHPASTE_CONVERSATION_ID } from '@/lib/eza/mirror/conversationMirrorV2/toothpasteConversationFixture';
import { buildConversationMirrorEntries } from '@/lib/eza/mirror/conversationMirrorEntries';
import { MIRROR_V2_QA_SCENARIOS } from '@/lib/eza/mirror/conversationMirrorV2/qaScenarios';

describe('cinematicCopyContract', () => {
  it('strips coaching and dashboard phrases', () => {
    expect(sanitizeCinematicCopy('Yarın için ipucu: hedef koy')).toBe('');
    expect(sanitizeCinematicCopy('Bugün görünen desen')).toBe('');
  });

  it('filters literal travel/product keywords from atmosphere list', () => {
    const atmosphere = toEmotionalAtmosphere([
      'japan',
      'tokyo',
      'wonder',
      'curiosity',
      'fuji',
    ]);
    expect(atmosphere).toEqual(['wonder', 'curiosity']);
  });

  it('clamps title and mirror text word counts', () => {
    expect(clampWords('Uzak Doğuda Yeni Bir Bakış', 5)).toBe('Uzak Doğuda Yeni Bir Bakış');
    expect(polishMirrorText('a '.repeat(50)).split(/\s+/).length).toBeLessThanOrEqual(40);
  });
});

describe('mirror v2 cinematic art direction', () => {
  it('japan payload uses approved title and emotional atmosphere', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const entries = scenario.buildEntries();
    const payload = buildMirrorPayload(entries, {
      seed: 'qa-japan-travel',
      conversationId: 'qa-japan-travel',
      season: 'golden_hour',
    });

    expect(payload.mirrorTitle).toBe('Uzak Doğuda Yeni Bir Bakış');
    expect(payload.visualKeywords).not.toContain('japan');
    expect(payload.visualKeywords).not.toContain('tokyo');
    expect(payload.mirrorText.toLowerCase()).toContain('japonya');
  });

  it('prompt forbids dashboard blocks and literal tourism clichés', () => {
    const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'japan-travel')!;
    const payload = buildMirrorPayload(scenario.buildEntries(), {
      seed: 'qa-japan-travel',
      conversationId: 'qa-japan-travel',
    });
    const prompt = buildMirrorV2ImagePrompt(payload);

    expect(prompt).toContain('Bugün Görünen Desen');
    expect(prompt.toLowerCase()).toContain('forbidden');
    expect(prompt.toLowerCase()).toContain('not fuji');
    expect(prompt.toLowerCase()).toContain('emotional atmosphere');
    expect(prompt).not.toContain(payload.topicSummary);
  });

  it('does not inject mirror story engine lines into payload copy', () => {
    const entries = buildToothpasteMirrorEntries();
    const payload = buildMirrorPayload(entries, {
      seed: 'toothpaste-demo',
      conversationId: TOOTHPASTE_CONVERSATION_ID,
    });
    const polished = polishMirrorPayloadCopy(payload);
    expect(polished.mirrorTitle.length).toBeGreaterThan(2);
    expect(polished.mirrorText).not.toMatch(/ilişki ritmi|güçleniyor/i);
  });

  it('architecture scenario uses memory/craft metaphor language', () => {
    const facadeEntries = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === 'architecture-facade')!.buildEntries();
    const payload = buildMirrorPayload(facadeEntries, {
      seed: 'qa-architecture-facade',
      conversationId: 'qa-architecture-facade',
    });
    expect(payload.safetyLevel).toBe('normal');
    expect(payload.sceneMetaphor.toLowerCase()).toMatch(/memory|craft|permanence|material|shadow/);
  });
});
