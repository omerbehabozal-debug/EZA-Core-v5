import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildFallbackMirrorVisual,
  buildMirrorVisualFromContext,
  buildVisualPrompt,
  inferSceneTopicKey,
} from '@/lib/eza/mirror/visualPromptEngine';
import {
  EZA_VISUAL_STYLE_CONTRACT,
  STANDARD_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/visualStyleContract';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';

function makeEntry(overrides: Partial<SavedBehavioralEntry> = {}): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `id-${Math.random()}`,
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    vector: {
      input_risk: 0.15,
      output_risk: 0.1,
      input_health: 0.85,
      output_health: 0.9,
      alignment_score: 82,
      eza_final: 80,
      intent: 'question',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.05, risk_delta_output_minus_input: -0.05, index: 0.1 },
    ...overrides,
  };
}

function promptHasNoTextRules(prompt: string): void {
  const lower = prompt.toLowerCase();
  expect(lower).toContain('no text');
  expect(lower).toContain('no typography');
  expect(lower).toContain('no letters');
  expect(lower).toContain('no numbers');
  expect(lower).toContain('no logo');
  expect(lower).toContain('no ui labels');
  expect(lower).toContain('no signage');
  expect(lower).toContain('no readable writing');
}

function promptHasStyleContract(prompt: string): void {
  const lower = prompt.toLowerCase();
  expect(lower).toContain('premium soft 3d illustration');
  expect(lower).toContain('cinematic but calm');
  expect(lower).toContain('elegant pastel color palette');
  expect(lower).toContain('polished product illustration');
  expect(lower).toContain('clean left side for ui overlay');
  expect(lower).toContain('vertical 9:16 friendly composition');
  expect(EZA_VISUAL_STYLE_CONTRACT.split(', ').every((phrase) => lower.includes(phrase.toLowerCase()))).toBe(
    true
  );
}

function promptHasLeftOverlayRules(prompt: string): void {
  const lower = prompt.toLowerCase();
  expect(lower).toContain('left upper and left-middle areas clean');
  expect(lower).toMatch(/right side|right-center/);
  expect(lower).toContain('lower third calmer');
}

describe('visualStyleContract', () => {
  it('negative prompt blocks quality risks', () => {
    const neg = STANDARD_NEGATIVE_PROMPT.toLowerCase();
    expect(neg).toMatch(/text, letters, numbers, logo/);
    expect(neg).toContain('extra limbs');
    expect(neg).toContain('broken hands');
    expect(neg).toContain('creepy face');
    expect(neg).toContain('cheap sticker style');
    expect(neg).toContain('over saturated colors');
    expect(neg).toContain('low quality');
  });
});

describe('visualPromptEngine', () => {
  it('prompt includes EZA style contract on every topic', () => {
    const visual = buildFallbackMirrorVisual();
    promptHasStyleContract(visual.prompt);
    expect(visual.stylePreset).toBe('eza_mirror_professional_v1');
    expect(visual.qualityHints.length).toBeGreaterThan(0);
  });

  it('finance topic includes terrace / skyline / gold-green vocabulary', () => {
    const visual = buildVisualPrompt({
      characterId: 'decision_direction',
      characterName: 'Yol Arayan',
      personaFamilyId: 'decision_direction',
      topicKey: 'finance',
      seedHint: 'test-finance',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toMatch(/city terrace|golden hour|skyline|marble|green and gold|planning/);
    promptHasStyleContract(visual.prompt);
    expect(visual.topicLabel).toMatch(/finans/i);
  });

  it('health topic includes wellness / nature vocabulary', () => {
    const visual = buildVisualPrompt({
      characterId: 'balanced_calm',
      characterName: 'Sakin Gözlemci',
      personaFamilyId: 'balanced_calm',
      topicKey: 'health',
      seedHint: 'test-health',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toMatch(/wellness garden|morning light|lake|seaside|lavender|restorative/);
    expect(visual.topicLabel).toMatch(/sağlık/i);
  });

  it('friendship topic includes bridge / lakeside / empathy vocabulary', () => {
    const visual = buildVisualPrompt({
      characterId: 'sensitive_careful',
      characterName: 'Dikkatli Yolcu',
      personaFamilyId: 'sensitive_careful',
      topicKey: 'friendship',
      seedHint: 'test-friendship',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toMatch(/park bridge|lakeside|sunset|purple|peach|empathy/);
    expect(visual.topicLabel).toMatch(/arkadaşlık|ilişki/i);
  });

  it('prompt always enforces textless composition rules', () => {
    const visual = buildFallbackMirrorVisual();
    promptHasNoTextRules(visual.prompt);
    promptHasLeftOverlayRules(visual.prompt);
    expect(visual.prompt.toLowerCase()).toContain('friendly');
    expect(visual.prompt.toLowerCase()).toContain('non-creepy');
  });

  it('negative prompt uses strengthened standard contract', () => {
    const visual = buildFallbackMirrorVisual();
    expect(visual.negativePrompt).toBe(STANDARD_NEGATIVE_PROMPT);
  });

  it('fallback topic uses genel düşünce labels and calm threshold scene', () => {
    const visual = buildFallbackMirrorVisual();
    expect(visual.topicLabel).toBe('genel düşünce');
    expect(visual.atmosphereLabel).toMatch(/sakin|düşünsel/i);
    expect(visual.emotionLabel).toMatch(/dengeli ve meraklı/i);
    expect(visual.prompt.toLowerCase()).toMatch(/tranquil indoor-outdoor|calm reflective/);
  });

  it('seedHint is deterministic for same inputs', () => {
    const a = buildMirrorVisualFromContext({
      entries: [makeEntry()],
      characterName: 'Test',
      personaFamilyId: 'balanced_calm',
      seed: 'fixed-seed',
    });
    const b = buildMirrorVisualFromContext({
      entries: [makeEntry()],
      characterName: 'Test',
      personaFamilyId: 'balanced_calm',
      seed: 'fixed-seed',
    });
    expect(a.seedHint).toBe(b.seedHint);
    expect(a.seedHint).toMatch(/^mirror-visual-/);
  });

  it('infers finance from decision_support category', () => {
    const entries = [
      makeEntry({
        vector: { ...makeEntry().vector, intent: 'question' },
      }),
      makeEntry(),
      makeEntry(),
    ];
    const topic = inferSceneTopicKey(entries, 'decision_support', 'decision_direction');
    expect(topic).toBe('finance');
  });
});

describe('mirrorStateEngine visual field', () => {
  it('attaches visual payload on daily mirror card', () => {
    const entries = Array.from({ length: 3 }, () =>
      makeEntry({
        standaloneObservation: {
          user_pattern: { category: 'decision_direction', confidence: 0.8, signals: [] },
          ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
          relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: [] },
        },
      })
    );
    const state = buildMirrorState(entries, { seed: 'visual-test' });
    expect(state.dailyMirrorCard.visual).toBeDefined();
    expect(state.dailyMirrorCard.visual?.prompt.length).toBeGreaterThan(120);
    promptHasNoTextRules(state.dailyMirrorCard.visual!.prompt);
    promptHasStyleContract(state.dailyMirrorCard.visual!.prompt);
    expect(state.dailyMirrorCard.visual?.qualityHints?.length).toBeGreaterThan(0);
  });
});
