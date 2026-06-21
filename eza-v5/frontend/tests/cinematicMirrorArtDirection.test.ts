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
import { buildMirrorPayloadV3 } from '@/lib/eza/mirror/conversationMirrorV3/buildMirrorPayloadV3';
import { buildMirrorV3ImagePrompt } from '@/lib/eza/mirror/conversationMirrorV3/promptBuilderV3';
import { getNarrativeDistanceVisualGuidance } from '@/lib/eza/mirror/conversationMirrorV3/narrativeDistance';
import { resolveShotMode } from '@/lib/eza/mirror/conversationMirrorV3/artDirectionV32';
import { getSeasonProfile } from '@/lib/eza/mirror/conversationMirrorV2/seasonRegistry';
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

const V32_SCENARIO_IDS = [
  'japan-travel',
  'architecture-facade',
  'toothpaste-choice',
  'bmw-mercedes',
  'ai-trust',
  'spirituality',
] as const;

describe('mirror v3.3 art direction prompt contract', () => {
  for (const id of V32_SCENARIO_IDS) {
    it(`${id} prompt includes evidence-first director blocks`, () => {
      const scenario = MIRROR_V2_QA_SCENARIOS.find((s) => s.id === id)!;
      const payload = buildMirrorPayloadV3(scenario.buildEntries(), {
        seed: `qa-v33-${id}`,
        conversationId: `qa-v33-${id}`,
        season: scenario.season,
      });
      const prompt = buildMirrorV3ImagePrompt(payload);
      const season = getSeasonProfile(payload.season);

      expect(payload.conversationEvidence.length).toBeGreaterThanOrEqual(3);
      expect(prompt).toContain('Conversation evidence:');
      expect(prompt).toContain('Topic visibility rule:');
      expect(prompt).toContain('Typography director:');
      expect(prompt).toContain('Cinematography contract:');
      expect(prompt).toContain('Lighting recipe:');
      expect(prompt).toContain(season.lightingRecipe);
      expect(prompt).toContain('Shot mode (');
      expect(prompt).toContain('Reference tier:');
      expect(prompt).toMatch(/Narrative distance visual behavior:/);
      expect(prompt).not.toMatch(/Reference tier:[\s\S]*Reference tier:/);
    });
  }

  it('narrative distance visual guidance differs by level', () => {
    const d2 = getNarrativeDistanceVisualGuidance(2);
    const d3 = getNarrativeDistanceVisualGuidance(3);
    expect(d2.toLowerCase()).toContain('intimate');
    expect(d3.toLowerCase()).toContain('wide atmospheric');
    expect(d3).toContain('15%');
  });

  it('all seasons expose lighting recipes', () => {
    for (const seasonId of [
      'bright_cinematic',
      'night_discovery',
      'editorial_magazine',
      'film_poster',
      'quiet_luxury',
      'golden_hour',
    ] as const) {
      expect(getSeasonProfile(seasonId).lightingRecipe.length).toBeGreaterThan(20);
    }
  });

  it('shot rotation includes silhouette at most 20% of sample seeds', () => {
    let silhouettes = 0;
    for (let i = 0; i < 100; i += 1) {
      if (resolveShotMode(`sample-seed-${i}`).mode === 'walking_away_silhouette') {
        silhouettes += 1;
      }
    }
    expect(silhouettes).toBeLessThanOrEqual(25);
    expect(silhouettes).toBeGreaterThanOrEqual(10);
  });
});
