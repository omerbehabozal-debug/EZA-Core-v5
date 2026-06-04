import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { composeNarrativeCore } from '@/lib/eza/mirror/narrativeCoreEngine';
import { deriveReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';

function entry(overrides: Partial<SavedBehavioralEntry> = {}): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'n1',
    mode: 'standalone',
    savedAt: '2026-01-15T10:00:00.000Z',
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
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

describe('narrativeCoreEngine (P4-A)', () => {
  it('vehicle comparison → comparison', () => {
    const entries = [
      entry({
        mirrorCueHints: ['bmw', 'mercedes', 'compare'],
        vector: { ...entry().vector, intent: 'bmw mercedes compare' },
      }),
    ];
    const core = composeNarrativeCore({
      entries,
      lockedIntent: 'premium_vehicle_comparison',
      storyTopicKey: 'finance',
      storyVariant: 'compare',
      reflectionSignals: deriveReflectionSignals(entries),
    });
    expect(core).toBe('comparison');
  });

  it('architecture creation → creation', () => {
    const entries = [entry({ mirrorCueHints: ['villa', 'mimari', 'cephe'] })];
    expect(
      composeNarrativeCore({
        entries,
        lockedIntent: null,
        storyTopicKey: 'architecture',
        reflectionSignals: deriveReflectionSignals(entries),
      })
    ).toBe('creation');
  });

  it('travel → exploration', () => {
    const entries = [entry({ mirrorCueHints: ['semerkant', 'seyahat'] })];
    expect(
      composeNarrativeCore({
        entries,
        lockedIntent: null,
        storyTopicKey: 'travel',
        reflectionSignals: deriveReflectionSignals(entries),
      })
    ).toBe('exploration');
  });

  it('health → care', () => {
    const entries = [entry({ mirrorCueHints: ['beslenme', 'uyku', 'sağlık'] })];
    expect(
      composeNarrativeCore({
        entries,
        lockedIntent: null,
        storyTopicKey: 'health',
        reflectionSignals: deriveReflectionSignals(entries),
      })
    ).toBe('care');
  });

  it('finance/risk → uncertainty', () => {
    const entries = [entry({ mirrorCueHints: ['yatırım', 'risk', 'gelecek'] })];
    expect(
      composeNarrativeCore({
        entries,
        lockedIntent: null,
        storyTopicKey: 'finance',
        reflectionSignals: deriveReflectionSignals(entries),
      })
    ).toBe('uncertainty');
  });
});
