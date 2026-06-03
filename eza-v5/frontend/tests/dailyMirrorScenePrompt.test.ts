import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';
import {
  buildDailyAvatarScenePhrase,
  buildDailyIdentityPromptBlock,
  buildDailyThemeScenePhrase,
  sanitizeDailySceneConceptForPrompt,
} from '@/lib/eza/mirror/dailyMirrorScenePrompt';
import {
  buildFallbackMirrorVisual,
  buildMirrorVisualFromContext,
} from '@/lib/eza/mirror/visualPromptEngine';
import { buildMirrorNegativePrompt } from '@/lib/eza/mirror/ezaVisualCanon';

const EXPLORATION_OBS = {
  user_pattern: {
    category: 'curiosity_exploration',
    confidence: 0.85,
    signals: ['semerkant', 'registan', 'seyahat'],
  },
  ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
  relationship_balance: { category: 'curious_balance', confidence: 0.75, signals: [] },
};

function makeEntry(overrides: Partial<SavedBehavioralEntry> = {}): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'stable-1',
    mode: 'standalone',
    savedAt: '2026-01-15T10:00:00.000Z',
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
    standaloneObservation: EXPLORATION_OBS,
    ...overrides,
  };
}

describe('dailyMirrorScenePrompt (P1)', () => {
  it('dailyAvatarArchetypeId and avatar id reflect in scene phrase', () => {
    const phrase = buildDailyAvatarScenePhrase({
      dailyAvatarId: 'horizon_explorer',
      dailyAvatarArchetypeId: 'journey_traveler',
      dailyAvatarType: 'metaphor',
    });
    expect(phrase?.toLowerCase()).toContain('horizon explorer');
  });

  it('dailyThemeTitle maps to English theme environment phrase', () => {
    const theme = buildDailyThemeScenePhrase('Semerkant Yolculuğu');
    expect(theme?.toLowerCase()).toMatch(/samarkand|registan/);
    expect(theme?.toLowerCase()).toMatch(/travel|route/);
  });

  it('dailySceneConcept appears sanitized in identity block', () => {
    const block = buildDailyIdentityPromptBlock({
      dailyAvatarId: 'horizon_explorer',
      dailyAvatarArchetypeId: 'journey_traveler',
      dailyAvatarType: 'metaphor',
      dailyThemeTitle: 'Semerkant Yolculuğu',
      dailySceneConcept:
        'Ufuk Kaşifi, Semerkant meydanında yeni rotaları inceliyor.',
    });
    expect(block?.toLowerCase()).toContain('registan');
    expect(block?.toLowerCase()).toContain('samarkand');
    expect(block?.toLowerCase()).toContain('textless');
  });

  it('same entries yield same visual prompt and seedHint', () => {
    const entries = Array.from({ length: MIRROR_MIN_SAMPLES }, (_, i) =>
      makeEntry({ interaction_id: `e-${i}`, savedAt: `2026-01-15T${10 + i}:00:00.000Z` })
    );
    const a = buildMirrorState(entries, { seed: 'p1-prompt-stable' });
    const b = buildMirrorState(entries, { seed: 'p1-prompt-stable' });
    expect(a.dailyMirrorCard.visual?.prompt).toBe(b.dailyMirrorCard.visual?.prompt);
    expect(a.dailyMirrorCard.visual?.seedHint).toBe(b.dailyMirrorCard.visual?.seedHint);
  });

  it('new entry can change visual prompt and seedHint', () => {
    const base = Array.from({ length: MIRROR_MIN_SAMPLES }, (_, i) =>
      makeEntry({ interaction_id: `b-${i}`, savedAt: `2026-01-10T${10 + i}:00:00.000Z` })
    );
    const extended = [
      ...base,
      makeEntry({
        interaction_id: 'b-new',
        savedAt: '2026-02-01T12:00:00.000Z',
        standaloneObservation: {
          ...EXPLORATION_OBS,
          user_pattern: {
            category: 'planning_structure',
            confidence: 0.9,
            signals: ['mimari', 'villa', 'restorasyon'],
          },
        },
      }),
    ];
    const before = buildMirrorState(base, { seed: 'p1-change' });
    const after = buildMirrorState(extended, { seed: 'p1-change' });
    expect(after.dailyMirrorCard.visual?.seedHint).not.toBe(before.dailyMirrorCard.visual?.seedHint);
  });

  it('fallback works when daily identity is omitted', () => {
    const visual = buildMirrorVisualFromContext({
      entries: [makeEntry()],
      characterName: 'Dengeli yolcu',
      personaFamilyId: 'balanced_calm',
      seed: 'legacy-fallback',
    });
    expect(visual.prompt.length).toBeGreaterThan(80);
    expect(visual.prompt.toLowerCase()).not.toContain('daily mirror identity scene');
  });

  it('negative prompt retains text and logo prohibitions', () => {
    const neg = buildMirrorNegativePrompt('general').toLowerCase();
    expect(neg).toMatch(/text|typography|letters/);
    expect(neg).toMatch(/logo/);
    const fallback = buildFallbackMirrorVisual();
    expect(fallback.negativePrompt.toLowerCase()).toMatch(/text|logo/);
  });

  it('strips PII-like content from scene concept', () => {
    const sanitized = sanitizeDailySceneConceptForPrompt(
      'Ali Veli ali@test.com +905551112233 https://secret.example/path ile rota',
      'Keşif Yolculuğu'
    );
    expect(sanitized).toBeTruthy();
    expect(sanitized).not.toMatch(/@/);
    expect(sanitized).not.toMatch(/90555/);
    expect(sanitized).not.toMatch(/https?:/);
    expect(sanitized).not.toMatch(/ali@test/i);
  });
});
