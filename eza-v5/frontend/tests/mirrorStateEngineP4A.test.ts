import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';
import { MIRROR_MIN_SAMPLES } from '@/lib/eza/mirror/types';
import { withDevVehicleCueHints } from '@/lib/eza/mirror/mirrorIntentContext';
import { narrativePromptSectionOrder } from '@/lib/eza/mirror/dailyMirrorFullCanvasPrompt';

function bmwEntry(): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'bmw-p4',
    mode: 'standalone',
    savedAt: '2026-01-15T10:00:00.000Z',
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 82,
      eza_final: 78,
      intent: 'bmw mercedes konfor compare',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    mirrorCueHints: ['bmw', 'mercedes', 'konfor', 'compare'],
    standaloneObservation: {
      user_pattern: {
        category: 'decision_direction',
        confidence: 0.9,
        signals: ['bmw', 'mercedes', 'konfor'],
      },
      ai_behavior: { category: 'explanatory', confidence: 0.85, signals: [] },
      relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: [] },
    },
  };
}

describe('buildMirrorState P4-A narrative fields', () => {
  it('card includes narrative pipeline fields', () => {
    const entries = Array.from({ length: MIRROR_MIN_SAMPLES }, () => bmwEntry());
    const card = buildMirrorState(entries, { seed: 'p4-fields' }).dailyMirrorCard;
    expect(card.narrativeCoreId).toBe('comparison');
    expect(card.storyTensionTitle).toBe('Two paths. One decision.');
    expect(card.mirrorMoment).toBe('Standing still before choosing.');
    expect(card.sceneArchetypeId).toMatch(/crossroads|comparison_studio/);
    expect(card.dailyThemeTitle).toBe('Araç Kararı');
    expect(card.dailyAvatarName).toBeTruthy();
  });

  it('BMW/Mercedes fixture produces comparison narrative in prompt', () => {
    const entries = withDevVehicleCueHints(
      Array.from({ length: MIRROR_MIN_SAMPLES }, (_, i) => ({
        ...bmwEntry(),
        interaction_id: `bmw-${i}`,
      }))
    );
    const visual = buildMirrorState(entries, { seed: 'p4-bmw' }).dailyMirrorCard.visual!;
    expect(visual.prompt.toLowerCase()).toContain('standing still before choosing');
    const order = narrativePromptSectionOrder(visual.prompt);
    expect(order.momentIdx).toBeGreaterThan(-1);
    expect(order.tensionIdx).toBeGreaterThan(order.momentIdx);
    expect(visual.negativePrompt.toLowerCase()).toContain('poster');
    expect(visual.negativePrompt.toLowerCase()).toContain('mascot');
  });
});
