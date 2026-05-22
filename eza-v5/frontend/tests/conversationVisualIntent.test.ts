import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  deriveConversationVisualIntent,
  shouldSuppressPandaFallback,
} from '@/lib/eza/mirror/conversationVisualIntent';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { buildMirrorNegativePrompt } from '@/lib/eza/mirror/ezaVisualCanon';

function entry(intent: string, signals: string[] = []): SavedBehavioralEntry {
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
      alignment_score: 82,
      eza_final: 78,
      intent,
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    standaloneObservation: {
      user_pattern: {
        category: 'decision_direction',
        confidence: 0.85,
        signals,
      },
      ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
      relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: [] },
    },
  };
}

describe('conversationVisualIntent (Sprint 11J)', () => {
  it('detects premium car comparison without storing user sentence', () => {
    const entries = [
      entry('compare options comfort sedan', ['choice_comparison']),
      entry('compare'),
      entry('compare'),
    ];
    const intent = deriveConversationVisualIntent({
      entries,
      topicKey: 'finance',
      storyVariant: 'compare',
    });
    expect(intent.id).toBe('premium_vehicle_comparison');
    expect(intent.label).toBe('premium car comparison');
    expect(intent.composition).toBe('comparison_scene');
    expect(intent.characterMode).toBe('stylized_human');
    expect(intent.mizansen.toLowerCase()).toContain('garage');
    expect(intent.mizansen.toLowerCase()).toContain('decision');
    expect(intent.mizansen.toLowerCase()).not.toContain('bmw');
    expect(shouldSuppressPandaFallback(intent)).toBe(true);
  });

  it('detects culinary wellness from recipe cues', () => {
    const intent = deriveConversationVisualIntent({
      entries: [entry('gluten free recipe kitchen'), entry('cook'), entry('health')],
      topicKey: 'health',
      storyVariant: 'nourish',
    });
    expect(intent.id).toBe('culinary_wellness');
    expect(intent.mizansen.toLowerCase()).toContain('kitchen');
  });

  it('detects restoration research for architecture topic', () => {
    const intent = deriveConversationVisualIntent({
      entries: [entry('architecture restoration material stone'), entry('design')],
      topicKey: 'architecture',
      storyVariant: 'craft',
    });
    expect(intent.id).toBe('restoration_research');
    expect(intent.composition).toBe('restoration_scene');
    expect(intent.mizansen.toLowerCase()).toContain('atelier');
  });

  it('buildMirrorVisualFromContext prompt uses cinematic mizansen not generic owl terrace', () => {
    const visual = buildMirrorVisualFromContext({
      entries: [
        entry('compare car comfort konfor', ['choice_comparison']),
        entry('compare'),
        entry('compare'),
      ],
      characterName: 'Karar Yolcusu',
      personaFamilyId: 'decision_direction',
      seed: 'bmw-qa',
      storyVariant: 'compare',
      storyTopicKey: 'finance',
    });
    const p = visual.prompt.toLowerCase();
    expect(visual.sceneIntentLabel).toBe('premium car comparison');
    expect(p).toContain('decision moment');
    expect(p).toContain('executive sedans');
    expect(p).toContain('hero object');
    expect(p).toContain('decision moment');
    expect(p).not.toContain('bilgeli baykuş');
    expect(p).not.toContain('city terrace golden hour');
    expect(p).toContain('not a chat screenshot');
    expect(p).toContain('camera grammar');
  });

  it('negative prompt includes context scene avoid rules', () => {
    const neg = buildMirrorNegativePrompt('finance').toLowerCase();
    expect(neg).toContain('generic mascot scene');
    expect(neg).toContain('random panda');
    expect(neg).toContain('chat screenshot');
  });
});
