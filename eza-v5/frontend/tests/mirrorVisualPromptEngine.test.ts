import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildFallbackMirrorVisual,
  buildMirrorVisualFromContext,
  buildVisualPrompt,
  inferSceneTopicKey,
} from '@/lib/eza/mirror/visualPromptEngine';
import {
  buildMirrorNegativePrompt,
  EZA_VISUAL_STYLE_CONTRACT,
  STANDARD_NEGATIVE_PROMPT,
} from '@/lib/eza/mirror/visualStyleContract';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { narrativePromptSectionOrder } from '@/lib/eza/mirror/dailyMirrorFullCanvasPrompt';
import { withDevVehicleCueHints } from '@/lib/eza/mirror/mirrorIntentContext';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';

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
  expect(lower).toMatch(/no text|textless/);
  expect(lower).toMatch(/no typography|no readable text|textless/);
  expect(lower).toMatch(/no letters|no readable/);
  expect(lower).toMatch(/no numbers|no readable/);
  expect(lower).toMatch(/no logo|no logos|, logos,|buttons, logos/);
  expect(lower).toMatch(/no ui|do not generate ui|not a chat|no chat/);
  expect(lower).toMatch(/no signage|no readable/);
  expect(lower).toMatch(/no readable writing|textless/);
}

function promptHasStyleContract(prompt: string): void {
  const lower = prompt.toLowerCase();
  expect(lower).toMatch(/premium soft 3d realism|premium cinematic editorial/);
  expect(lower).toMatch(
    /editorial character illustration|premium cinematic editorial scene|premium editorial/
  );
  expect(lower).toMatch(/calm cinematic atmosphere|film still atmosphere|warm emotional realism/);
  expect(lower).toMatch(/clean left|typography safe|overlay safe/);
  expect(lower).toMatch(/not a toy|not cartoon|not mascot/);
  expect(lower).toMatch(
    /mature premium editorial|premium stylized|premium editorial campaign|premium cinematic editorial/
  );
}

function promptHasFullCanvasCompositionRules(prompt: string): void {
  const lower = prompt.toLowerCase();
  expect(lower).toMatch(
    /away from the top and bottom edges|important subjects away from top and bottom|edge breathing/
  );
  expect(lower).toMatch(/center of the composition|focal point near center|emotional focus near center/);
  expect(lower).not.toMatch(/\d+\s*%/);
}

describe('visualStyleContract', () => {
  it('negative prompt blocks quality and childish toy risks', () => {
    const neg = STANDARD_NEGATIVE_PROMPT.toLowerCase();
    expect(neg).toMatch(/text, letters, numbers, logo/);
    expect(neg).toContain('childish');
    expect(neg).toContain('bean character');
    expect(neg).toContain('sticker');
    expect(neg).toContain('plastic toy');
    expect(neg).toContain('cheap mascot');
  });
});

describe('visualPromptEngine', () => {
  it('prompt includes EZA style contract on every topic', () => {
    const visual = buildFallbackMirrorVisual();
    promptHasStyleContract(visual.prompt);
    expect(visual.stylePreset).toBe('eza_mirror_professional_v1');
    expect(visual.qualityHints.length).toBeGreaterThan(0);
  });

  it('finance topic uses intent-first cinematic scene (not generic owl terrace)', () => {
    const visual = buildVisualPrompt({
      characterId: 'decision_direction',
      characterName: 'Yol Arayan',
      personaFamilyId: 'decision_direction',
      topicKey: 'finance',
      seedHint: 'test-finance',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toMatch(/research|decision|comparison|editorial/);
    expect(p).not.toContain('city terrace golden hour');
    promptHasStyleContract(visual.prompt);
    expect(visual.topicLabel).toMatch(/finans/i);
    expect(visual.sceneIntentLabel).toBeTruthy();
  });

  it('health topic uses wellness or culinary cinematic vocabulary', () => {
    const visual = buildVisualPrompt({
      characterId: 'balanced_calm',
      characterName: 'Şefkatli Geyik',
      personaFamilyId: 'balanced_calm',
      topicKey: 'health',
      seedHint: 'test-health',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toMatch(/wellness|kitchen|restorative|culinary|morning light/);
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

  it('prompt always enforces textless composition and canon guardrails', () => {
    const visual = buildFallbackMirrorVisual();
    promptHasNoTextRules(visual.prompt);
    promptHasFullCanvasCompositionRules(visual.prompt);
    expect(visual.prompt.toLowerCase()).toContain('not a toy');
    expect(visual.prompt.toLowerCase()).toContain('mature premium editorial character');
    expect(visual.prompt.toLowerCase()).not.toMatch(/message bubbles|chat screenshot/);
  });

  it('negative prompt uses strengthened standard contract', () => {
    const visual = buildFallbackMirrorVisual();
    expect(visual.negativePrompt).toContain(buildMirrorNegativePrompt('general').slice(0, 80));
    expect(visual.negativePrompt).toContain('generic mascot scene');
    expect(visual.negativePrompt).toContain(STANDARD_NEGATIVE_PROMPT.slice(0, 40));
  });

  it('fallback topic uses genel düşünce labels and calm threshold scene', () => {
    const visual = buildFallbackMirrorVisual();
    expect(visual.topicLabel).toBe('genel düşünce');
    expect(visual.atmosphereLabel).toMatch(/sakin|düşünsel/i);
    expect(visual.emotionLabel).toMatch(/dengeli ve meraklı/i);
    expect(visual.prompt.toLowerCase()).toMatch(
      /tranquil threshold|calm reflective|contemplation|quiet reflection|threshold interior|reflective/
    );
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
  it('binds P4-A narrative moment into visual prompt when card has travel cues', () => {
    const entries = Array.from({ length: MIRROR_MIN_SAMPLES }, (_, i) =>
      makeEntry({
        interaction_id: `p1-${i}`,
        savedAt: `2026-01-15T${10 + i}:00:00.000Z`,
        standaloneObservation: {
          user_pattern: {
            category: 'curiosity_exploration',
            confidence: 0.9,
            signals: ['semerkant', 'registan', 'seyahat'],
          },
          ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
          relationship_balance: { category: 'curious_balance', confidence: 0.8, signals: [] },
        },
      })
    );
    const state = buildMirrorState(entries, { seed: 'p1-visual-bind' });
    const prompt = state.dailyMirrorCard.visual!.prompt.toLowerCase();
    expect(prompt).toContain('visual moment:');
    expect(prompt).toContain('looking beyond the familiar');
    expect(prompt).not.toContain('daily mirror identity scene');
    expect(state.dailyMirrorCard.dailyAvatarName?.length).toBeGreaterThan(0);
    expect(state.dailyMirrorCard.visual?.seedHint).toMatch(/^mirror-visual-/);
  });

  it('P4-A narrative block orders moment before tension before archetype before theme before lens', () => {
    const entries = withDevVehicleCueHints(
      Array.from({ length: MIRROR_MIN_SAMPLES }, (_, i) =>
        makeEntry({
          interaction_id: `order-${i}`,
          savedAt: `2026-01-15T${10 + i}:00:00.000Z`,
          vector: {
            ...makeEntry().vector,
            intent: 'bmw mercedes konfor compare',
          },
          mirrorCueHints: ['bmw', 'mercedes', 'konfor', 'compare'],
          standaloneObservation: {
            user_pattern: {
              category: 'decision_direction',
              confidence: 0.9,
              signals: ['bmw', 'mercedes', 'konfor'],
            },
            ai_behavior: { category: 'explanatory', confidence: 0.85, signals: [] },
            relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: [] },
          },
        })
      )
    );
    const prompt = buildMirrorState(entries, { seed: 'p4-order' }).dailyMirrorCard.visual!.prompt;
    const order = narrativePromptSectionOrder(prompt);
    expect(order.momentIdx).toBeGreaterThanOrEqual(0);
    expect(order.tensionIdx).toBeGreaterThan(order.momentIdx);
    expect(order.archetypeIdx).toBeGreaterThan(order.tensionIdx);
    expect(order.themeIdx).toBeGreaterThan(order.archetypeIdx);
    expect(order.lensIdx).toBeGreaterThan(order.themeIdx);
  });

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
