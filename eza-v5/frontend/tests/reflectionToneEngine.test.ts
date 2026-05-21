import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  analyzeBehavioralRhythm,
  composeEmotionalReflection,
  inferReflectionTone,
  reflectionToneLabelTr,
} from '@/lib/eza/mirror/reflectionToneEngine';

function entry(overrides: Partial<SavedBehavioralEntry> = {}): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `id-${Math.random()}`,
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 80,
      eza_final: 75,
      intent: 'chat',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    ...overrides,
  };
}

const CRINGE_PATTERNS = [
  /sen özelsin/i,
  /başarı(lı)?\s*(koç|guru)/i,
  /manifest/i,
  /evren\s+sen/i,
  /ilahi/i,
  /motivasyon\s+poster/i,
];

describe('reflectionToneEngine', () => {
  it('infers mentally_tired from low energy and sparse questions', () => {
    const entries = Array.from({ length: 5 }, () =>
      entry({
        vector: {
          ...entry().vector,
          eza_final: 42,
          intent: 'chat',
        },
      })
    );
    const signals = analyzeBehavioralRhythm(entries);
    expect(inferReflectionTone(signals)).toBe('mentally_tired');
  });

  it('infers thoughtful from high question ratio', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      entry({
        vector: {
          ...entry().vector,
          intent: i < 5 ? 'question' : 'chat',
          eza_final: 70,
        },
      })
    );
    expect(inferReflectionTone(analyzeBehavioralRhythm(entries))).toBe('thoughtful');
  });

  it('infers emotionally_cautious when redirects dominate', () => {
    const entries = Array.from({ length: 6 }, () =>
      entry({
        vector: { ...entry().vector, redirect: true, eza_final: 65 },
      })
    );
    expect(inferReflectionTone(analyzeBehavioralRhythm(entries))).toBe('emotionally_cautious');
  });

  it('different seeds yield tone-specific quotes without cringe patterns', () => {
    const tired = composeEmotionalReflection({
      entries: Array.from({ length: 5 }, () =>
        entry({ vector: { ...entry().vector, eza_final: 40, intent: 'chat' } })
      ),
      seed: 'tired-a',
    });
    const thoughtful = composeEmotionalReflection({
      entries: Array.from({ length: 8 }, (_, i) =>
        entry({
          vector: {
            ...entry().vector,
            intent: i < 5 ? 'question' : 'chat',
          },
        })
      ),
      seed: 'thought-b',
    });

    expect(tired.reflectionTone).toBe('mentally_tired');
    expect(thoughtful.reflectionTone).toBe('thoughtful');
    expect(tired.quote).not.toBe(thoughtful.quote);

    for (const text of [tired.quote, tired.headline, tired.shortInsight, thoughtful.quote]) {
      for (const pattern of CRINGE_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it('exposes Turkish tone labels', () => {
    expect(reflectionToneLabelTr('calm_reflective')).toMatch(/Sakin/);
    expect(reflectionToneLabelTr('curious_light')).toMatch(/merak/i);
  });
});
