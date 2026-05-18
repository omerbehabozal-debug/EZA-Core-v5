import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildRelationshipMap } from '@/lib/eza/relationshipMapModel';
import { parseStandaloneObservation } from '@/lib/standaloneObservation';

const SAMPLE_OBS = {
  user_pattern: { category: 'decision_direction', confidence: 0.8, signals: ['a'] },
  ai_behavior: { category: 'explanatory', confidence: 0.8, signals: ['b'] },
  relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: ['c'] },
};

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

describe('buildRelationshipMap polish fields', () => {
  it('empty state is warm and complete', () => {
    const m = buildRelationshipMap([], 30);
    expect(m.totalInteractions).toBe(0);
    expect(m.editorialNote).toMatch(/henüz|birikmedi/i);
    expect(m.balancePills).toHaveLength(3);
    expect(m.islands).toHaveLength(0);
  });

  it('islands include description and intensity without percent as headline', () => {
    const entries = [
      makeEntry({ standaloneObservation: SAMPLE_OBS }),
      makeEntry({
        standaloneObservation: {
          ...SAMPLE_OBS,
          user_pattern: { category: 'clarity_simplification', confidence: 0.7, signals: [] },
        },
      }),
    ];
    const m = buildRelationshipMap(entries, 7);
    expect(m.islands.length).toBeGreaterThan(0);
    const top = m.islands[0]!;
    expect(top.description.length).toBeGreaterThan(10);
    expect(top.intensity).toBeGreaterThan(0);
    expect(m.editorialNote).not.toMatch(/^%/);
    expect(m.editorialNote).not.toMatch(/%\d+\)/);
  });

  it('period 7 30 90 all produce data when entries exist', () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()];
    for (const days of [7, 30, 90] as const) {
      const m = buildRelationshipMap(entries, days);
      expect(m.periodDays).toBe(days);
      expect(m.totalInteractions).toBeGreaterThan(0);
    }
  });

  it('uses backend categories when observation present', () => {
    const entries = [
      makeEntry({ standaloneObservation: SAMPLE_OBS }),
      makeEntry({ standaloneObservation: SAMPLE_OBS }),
    ];
    const m = buildRelationshipMap(entries, 30);
    const labels = m.islands.map((i) => i.label);
    expect(labels.some((l) => l.includes('Karar'))).toBe(true);
    expect(m.aiBehaviorTones.some((t) => t.label.includes('Açıklayıcı'))).toBe(true);
  });

  it('fallback aggregation when no observation', () => {
    const entries = [
      makeEntry({
        vector: {
          input_risk: 0.05,
          output_risk: 0.05,
          input_health: 0.95,
          output_health: 0.95,
          alignment_score: 90,
          eza_final: 88,
          intent: 'greeting',
          alignment_verdict: 'aligned',
          redirect: false,
          redirect_reason: null,
          policy_violation_count: 0,
        },
      }),
    ];
    const m = buildRelationshipMap(entries, 30);
    expect(m.islands.length).toBeGreaterThan(0);
    expect(parseStandaloneObservation(entries[0]!.standaloneObservation)).toBeNull();
  });
});
