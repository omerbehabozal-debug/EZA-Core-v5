import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';

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

describe('buildMirrorState', () => {
  it('empty history returns safe empty models', () => {
    const result = buildMirrorState([], {
      generatedAt: '2026-05-21T12:00:00.000Z',
    });
    expect(result.meta.sampleCount).toBe(0);
    expect(result.meta.hasEnoughData).toBe(false);
    expect(result.meta.source).toBe('local_history');
    expect(result.meta.generatedAt).toBe('2026-05-21T12:00:00.000Z');
    expect(result.meta.warnings).toContain('empty_history');
    expect(result.dailyMirrorCard.shareEnabled).toBe(false);
    expect(result.dailyMirrorCard.characterName).toBe('');
    expect(result.relationshipPattern.isShareable).toBe(false);
    expect(result.relationshipPattern.behaviorIslands).toHaveLength(0);
  });

  it('produces daily mirror fields from composed builders', () => {
    const entries = Array.from({ length: MIRROR_MIN_SAMPLES }, () =>
      makeEntry({ standaloneObservation: SAMPLE_OBS })
    );
    const result = buildMirrorState(entries, {
      seed: 'test-mirror-seed',
      generatedAt: '2026-05-21T12:00:00.000Z',
    });

    expect(result.meta.hasEnoughData).toBe(true);
    expect(result.meta.sampleCount).toBe(MIRROR_MIN_SAMPLES);
    expect(result.dailyMirrorCard.userLine.length).toBeGreaterThan(0);
    expect(result.dailyMirrorCard.aiLine.length).toBeGreaterThan(0);
    expect(result.dailyMirrorCard.balanceLine.length).toBeGreaterThan(0);
    expect(result.dailyMirrorCard.characterName.length).toBeGreaterThan(0);
    expect(result.dailyMirrorCard.personaFamilyId).toBeTruthy();
    expect(result.dailyMirrorCard.privacyText).toMatch(/gözlemsel/i);
    expect(result.dailyMirrorCard.shareEnabled).toBe(true);
    expect(result.dailyMirrorCard.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.dailyMirrorCard.reflectionTone).toBeTruthy();
    expect(result.dailyMirrorCard.quote?.length).toBeGreaterThan(8);
    expect(result.dailyMirrorCard.emotionalRhythm).toBeTruthy();
    expect(result.dailyMirrorCard.mirrorStory?.length).toBeGreaterThan(20);
    expect(result.dailyMirrorCard.relationshipMode).toBeTruthy();
    expect(result.dailyMirrorCard.userLine).not.toMatch(/sordun|araştırdın/i);
  });

  it('relationship pattern is never shareable and includes islands', () => {
    const entries = [
      makeEntry({ standaloneObservation: SAMPLE_OBS }),
      makeEntry({
        standaloneObservation: {
          ...SAMPLE_OBS,
          user_pattern: { category: 'clarity_simplification', confidence: 0.7, signals: [] },
        },
      }),
      makeEntry({ standaloneObservation: SAMPLE_OBS }),
    ];
    const result = buildMirrorState(entries, { periodDays: 7 });

    expect(result.relationshipPattern.isShareable).toBe(false);
    expect(result.relationshipPattern.period).toBe(7);
    expect(result.relationshipPattern.behaviorIslands.length).toBeGreaterThan(0);
    expect(result.relationshipPattern.dominantIsland?.label).toBeTruthy();
    expect(result.relationshipPattern.rhythmSummary.length).toBeGreaterThan(10);
    expect(result.relationshipPattern.generalBalanceLabel.length).toBeGreaterThan(0);
  });

  it('warns on insufficient samples below threshold', () => {
    const result = buildMirrorState([makeEntry()]);
    expect(result.meta.hasEnoughData).toBe(false);
    expect(result.meta.warnings).toContain('insufficient_samples');
    expect(result.dailyMirrorCard.shareEnabled).toBe(false);
  });

  it('warns when backend observation absent', () => {
    const entries = Array.from({ length: MIRROR_MIN_SAMPLES }, () => makeEntry());
    const result = buildMirrorState(entries);
    expect(result.meta.warnings).toContain('no_backend_observation');
  });
});
