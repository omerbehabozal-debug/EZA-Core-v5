import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { deriveConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import { buildCameraGrammarPhrases } from '@/lib/eza/mirror/cameraGrammarRegistry';
import { buildCinematicDirectionBlock } from '@/lib/eza/mirror/cinematicDirectionSystem';
import { resolveEmotionalPacing } from '@/lib/eza/mirror/emotionalPacingEngine';
import { buildVisualConflictPhrases, resolveVisualConflictLevel } from '@/lib/eza/mirror/visualConflictSystem';
import { buildEmotionalSceneBlock } from '@/lib/eza/mirror/emotionalSceneEngine';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { deriveReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import { resolveEmotionalTension } from '@/lib/eza/mirror/intentCompositionSystem';

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

describe('cinematicDirectionSystem (Sprint 11O)', () => {
  it('comparison camera uses low angle asymmetry not centered portrait', () => {
    const phrases = buildCameraGrammarPhrases('comparison_scene');
    const joined = phrases.join(' ').toLowerCase();
    expect(joined).toContain('asymmetr');
    expect(joined).toContain('low');
    expect(joined).toContain('never centered portrait');
  });

  it('car compare resolves cinematic_tension pacing and dual conflict', () => {
    const entries = [
      entry('compare bmw mercedes sedan', ['choice_comparison']),
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
    const tension = resolveEmotionalTension(intent.id, signals, 'compare');
    const pacing = resolveEmotionalPacing(signals, tension, 'compare');
    expect(['active', 'cinematic_tension']).toContain(pacing);
    const conflict = resolveVisualConflictLevel(intent.id, intent.composition, pacing);
    expect(conflict).toBe('dual');
    expect(buildVisualConflictPhrases(conflict).length).toBeGreaterThan(0);
  });

  it('emotional scene block includes directed film still and eye flow', () => {
    const entries = [entry('restoration stone sketch'), entry('material')];
    const signals = deriveReflectionSignals(entries);
    const intent = deriveConversationVisualIntent({
      entries,
      topicKey: 'architecture',
      storyVariant: 'craft',
    });
    const block = buildEmotionalSceneBlock({
      intent,
      reflectionSignals: signals,
      reflectionTone: 'thoughtful',
    });
    const p = block.phrases.join(' ').toLowerCase();
    expect(p).toContain('directed');
    expect(p).toContain('eye flow');
    expect(p).toContain('over-shoulder');
    expect(block.pacing).toBeDefined();
    expect(block.negativeExtras.join(' ')).toContain('wallpaper');
  });

  it('buildMirrorVisualFromContext adds pacing and camera quality hints', () => {
    const visual = buildMirrorVisualFromContext({
      entries: [
        entry('compare car comfort', ['choice_comparison']),
        entry('compare'),
        entry('compare'),
      ],
      characterName: 'Test',
      personaFamilyId: 'decision_direction',
      seed: 'cine-qa',
      storyVariant: 'compare',
      reflectionTone: 'thoughtful',
    });
    expect(visual.qualityHints.some((h) => h.startsWith('pacing:'))).toBe(true);
    expect(visual.qualityHints.some((h) => h.startsWith('camera:'))).toBe(true);
    expect(visual.prompt.toLowerCase()).toContain('camera grammar');
    expect(visual.negativePrompt.toLowerCase()).toContain('symmetrical portrait');
  });
});
