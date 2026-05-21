import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  composePrecisionQuote,
  composePrecisionStory,
  deriveReflectionSignals,
  inferMicroMood,
  pickTopicStoryVariant,
  sanitizePrecisionCopy,
} from '@/lib/eza/mirror/reflectionSignals';
import { composeMirrorStory } from '@/lib/eza/mirror/mirrorStoryEngine';

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
      eza_final: 70,
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

const SPIRITUAL = [/evren/i, /ruhun/i, /frekans/i, /ışık oldu/i];

describe('reflectionSignals', () => {
  it('derives higher comparisonIntensity from compare intents', () => {
    const compareEntries = Array.from({ length: 5 }, () =>
      entry({ vector: { ...entry().vector, intent: 'compare options' } })
    );
    const normalEntries = Array.from({ length: 5 }, () => entry());
    const cmp = deriveReflectionSignals(compareEntries);
    const base = deriveReflectionSignals(normalEntries);
    expect(cmp.comparisonIntensity).toBeGreaterThan(base.comparisonIntensity);
  });

  it('picks finance compare variant and observational story', () => {
    const entries = Array.from({ length: 5 }, () =>
      entry({ vector: { ...entry().vector, intent: 'compare' } })
    );
    const signals = deriveReflectionSignals(entries);
    const variant = pickTopicStoryVariant('finance', signals, inferMicroMood(signals, 'thoughtful'));
    expect(variant).toBe('compare');
    const story = composePrecisionStory('finance', signals, 'comparing', 'fin-a');
    expect(story.mirrorStory).toMatch(/netleş|kıyas|elemek/i);
    for (const p of SPIRITUAL) {
      expect(story.mirrorStory).not.toMatch(p);
    }
  });

  it('composePrecisionQuote stays calm and short', () => {
    const signals = deriveReflectionSignals([entry()]);
    const quote = composePrecisionQuote(signals, 'balanced_tempo', 'calm_reflective', 'q-1');
    expect(quote.length).toBeLessThan(80);
    expect(quote).not.toMatch(/evren|ruhun|manifest/i);
  });

  it('sanitizePrecisionCopy blocks spiritual phrasing', () => {
    expect(sanitizePrecisionCopy('Evren sana yeni bir yol açıyor.')).not.toMatch(/evren/i);
  });

  it('mirror story differs for travel vs finance with same seed prefix', () => {
    const travel = composeMirrorStory({
      entries: [entry({ vector: { ...entry().vector, intent: 'travel' } })],
      seed: 'var-1',
      reflectionTone: 'curious_light',
      emotionalRhythm: 'searching',
      personaFamilyId: 'curiosity_exploration',
    });
    const finance = composeMirrorStory({
      entries: [entry({ vector: { ...entry().vector, intent: 'compare' } })],
      seed: 'var-2',
      reflectionTone: 'thoughtful',
      emotionalRhythm: 'steady',
      personaFamilyId: 'decision_direction',
    });
    expect(travel.mirrorStory).not.toBe(finance.mirrorStory);
    expect(travel.storyVariant).not.toBe(finance.storyVariant);
  });
});
