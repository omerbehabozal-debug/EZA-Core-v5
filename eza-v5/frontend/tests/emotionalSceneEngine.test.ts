import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { deriveConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import {
  buildEmotionalSceneBlock,
  buildEmotionalScenePromptBlock,
} from '@/lib/eza/mirror/emotionalSceneEngine';
import { resolveHeroObject } from '@/lib/eza/mirror/heroObjectRegistry';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { deriveReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';

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

describe('emotionalSceneEngine (Sprint 11N)', () => {
  it('car comparison uses dual sedans hero and active tension', () => {
    const entries = [
      entry('compare bmw mercedes comfort sedan', ['choice_comparison']),
      entry('compare'),
      entry('compare'),
    ];
    const signals = deriveReflectionSignals(entries);
    const intent = deriveConversationVisualIntent({
      entries,
      topicKey: 'finance',
      storyVariant: 'compare',
      reflectionSignals: signals,
    });
    const hero = resolveHeroObject(intent.id, intent.composition);
    expect(hero.id).toBe('dual_executive_sedans');
    const block = buildEmotionalSceneBlock({
      intent,
      reflectionSignals: signals,
      storyVariant: 'compare',
    });
    expect(block.tension).toBe('active_comparison');
    const prompt = buildEmotionalScenePromptBlock({
      intent,
      reflectionSignals: signals,
      storyVariant: 'compare',
    }).toLowerCase();
    expect(prompt).toContain('executive sedans');
    expect(prompt).toContain('foreground');
    expect(prompt).toContain('camera grammar');
    expect(block.pacing).toMatch(/active|cinematic_tension/);
    expect(prompt).toContain('not a chat screenshot');
    expect(prompt).toContain('never centered portrait');
  });

  it('restoration scene foreground materials not portrait', () => {
    const entries = [entry('restoration stone material sketch'), entry('heritage')];
    const signals = deriveReflectionSignals(entries);
    const intent = deriveConversationVisualIntent({
      entries,
      topicKey: 'architecture',
      storyVariant: 'craft',
    });
    const block = buildEmotionalSceneBlock({ intent, reflectionSignals: signals });
    const p = block.phrases.join(' ').toLowerCase();
    expect(p).toContain('material samples');
    expect(p).toContain('hands');
  });

  it('buildMirrorVisualFromContext embeds emotional scene before mizansen', () => {
    const entries = [
      entry('compare car comfort', ['choice_comparison']),
      entry('compare'),
      entry('compare'),
    ];
    const visual = buildMirrorVisualFromContext({
      entries,
      characterName: 'Karar',
      personaFamilyId: 'decision_direction',
      seed: 'emo-qa',
      storyVariant: 'compare',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toContain('hero object');
    expect(p).toContain('film still');
    expect(p).toContain('decision moment');
    expect(visual.qualityHints.some((h) => h.includes('hero object'))).toBe(true);
    expect(visual.negativePrompt.toLowerCase()).toContain('wallpaper');
  });
});
