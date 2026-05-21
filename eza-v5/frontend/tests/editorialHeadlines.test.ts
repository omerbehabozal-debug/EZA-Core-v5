import { describe, it, expect } from 'vitest';
import { composeEditorialHeadline } from '@/lib/eza/mirror/editorialHeadlines';
import { composePrecisionStory } from '@/lib/eza/mirror/reflectionSignals';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

function entry(): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'id-1',
    mode: 'standalone',
    savedAt: new Date().toISOString(),
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 80,
      eza_final: 70,
      intent: 'compare',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
  };
}

describe('editorialHeadlines (Sprint 11G)', () => {
  it('returns mood-based editorial headline not category label', () => {
    const h = composeEditorialHeadline('calm_analysis', 'clarify', 'general', 'seed-1');
    expect(h).not.toMatch(/^gözlemsel\s+gün$/i);
    expect(h.length).toBeGreaterThan(4);
    expect(h.length).toBeLessThan(32);
  });

  it('composePrecisionStory uses editorial dailyJourney', () => {
    const signals = {
      comparisonIntensity: 0.7,
      curiosityDepth: 0.3,
      detailFocus: 0.2,
      calmnessLevel: 0.5,
      conversationalEnergy: 0.5,
      retryTendency: 0.1,
      opennessLevel: 0.4,
      planningFocus: 0.3,
      explorationDrive: 0.2,
      emotionalOpenness: 0.3,
    };
    const story = composePrecisionStory('finance', signals, 'comparing', 'fin-ed');
    expect(story.dailyJourney).not.toMatch(/^gözlemsel\s+gün$/i);
    expect(story.dailyJourney).not.toMatch(/^ölçülü kıyas$/i);
  });

  it('general stillness variant avoids placeholder category headline', () => {
    const story = composePrecisionStory(
      'general',
      {
        comparisonIntensity: 0.1,
        curiosityDepth: 0.2,
        detailFocus: 0.1,
        calmnessLevel: 0.8,
        conversationalEnergy: 0.2,
        retryTendency: 0.05,
        opennessLevel: 0.3,
        planningFocus: 0.1,
        explorationDrive: 0.1,
        emotionalOpenness: 0.2,
      },
      'calm_reflective',
      'gen-still'
    );
    expect(story.dailyJourney).not.toBe('Gözlemsel gün');
  });
});
