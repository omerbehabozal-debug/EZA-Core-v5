import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  composeMirrorStory,
  inferAiRelationshipMode,
  relationshipModeLabelTr,
} from '@/lib/eza/mirror/mirrorStoryEngine';
import { analyzeBehavioralRhythm } from '@/lib/eza/mirror/reflectionToneEngine';

const SAMPLE_OBS = {
  user_pattern: { category: 'decision_direction', confidence: 0.8, signals: ['a'] },
  ai_behavior: { category: 'explanatory', confidence: 0.8, signals: ['b'] },
  relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: ['c'] },
};

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

const LOG_PATTERNS = [/\bbrownie\b/i, /\btarif\s+sordun/i, /\bşunu\s+araştırdın/i];

describe('mirrorStoryEngine', () => {
  it('infers structured_analyst for finance-oriented behavior', () => {
    const entries = Array.from({ length: 4 }, () =>
      entry({
        standaloneObservation: SAMPLE_OBS,
        vector: { ...entry().vector, intent: 'decision' },
      })
    );
    const signals = analyzeBehavioralRhythm(entries);
    expect(
      inferAiRelationshipMode(signals, 'finance', 'focused_growth')
    ).toBe('structured_analyst');
  });

  it('composes health story without chat-log phrasing', () => {
    const entries = Array.from({ length: 4 }, () =>
      entry({
        standaloneObservation: {
          ...SAMPLE_OBS,
          user_pattern: { category: 'balanced_calm', confidence: 0.8, signals: [] },
        },
        vector: { ...entry().vector, intent: 'health' },
      })
    );
    const story = composeMirrorStory({
      entries,
      seed: 'health-story',
      reflectionTone: 'calm_reflective',
      emotionalRhythm: 'steady',
      personaFamilyId: 'balanced_calm',
    });

    expect(story.storyTopicKey).toBe('health');
    expect(story.mirrorStory).toMatch(/seçim|özen|iyi gelecek|ritim/i);
    for (const text of [
      story.mirrorStory,
      story.userStoryLine,
      story.aiStoryLine,
      story.balanceStoryLine,
    ]) {
      for (const p of LOG_PATTERNS) {
        expect(text).not.toMatch(p);
      }
    }
  });

  it('composes architecture restoration-style narrative', () => {
    const entries = Array.from({ length: 4 }, () =>
      entry({
        standaloneObservation: {
          ...SAMPLE_OBS,
          user_pattern: { category: 'clarity_simplification', confidence: 0.8, signals: [] },
        },
        vector: { ...entry().vector, intent: 'architecture' },
      })
    );
    const story = composeMirrorStory({
      entries,
      seed: 'arch-story',
      reflectionTone: 'thoughtful',
      emotionalRhythm: 'searching',
      personaFamilyId: 'clarity_simplification',
    });

    expect(story.storyTopicKey).toBe('architecture');
    expect(story.mirrorStory).toMatch(/detay|malzeme|karar|yapı|izler|netleş|anlamak/i);
    expect(story.visualStoryHints.some((h) => /stone|material|desk/i.test(h))).toBe(true);
  });

  it('differs travel vs finance mirror stories', () => {
    const travel = composeMirrorStory({
      entries: [
        entry({
          standaloneObservation: {
            ...SAMPLE_OBS,
            user_pattern: { category: 'curiosity_exploration', confidence: 0.8, signals: [] },
          },
          vector: { ...entry().vector, intent: 'travel' },
        }),
      ],
      seed: 'travel-1',
      reflectionTone: 'curious_light',
      emotionalRhythm: 'searching',
      personaFamilyId: 'curiosity_exploration',
    });
    const finance = composeMirrorStory({
      entries: [
        entry({
          standaloneObservation: SAMPLE_OBS,
          vector: { ...entry().vector, intent: 'finance' },
        }),
      ],
      seed: 'finance-1',
      reflectionTone: 'focused_growth',
      emotionalRhythm: 'steady',
      personaFamilyId: 'decision_direction',
    });

    expect(travel.mirrorStory).not.toBe(finance.mirrorStory);
    expect(travel.mirrorStory).toMatch(/ihtimal|yol|keşif|ufuk/i);
    expect(finance.mirrorStory).toMatch(/karar|netleş|kıyas|temkin|sadeleş/i);
  });

  it('exposes relationship mode labels', () => {
    expect(relationshipModeLabelTr('research_partner')).toMatch(/Araştırma/);
  });
});
