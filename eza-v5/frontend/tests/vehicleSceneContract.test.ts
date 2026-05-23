import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  assertVehicleComparisonPrompt,
  validateVehicleComparisonPrompt,
  VEHICLE_SCENE_CONTRACT_ID,
  VEHICLE_SCENE_FORBIDDEN,
  VEHICLE_SCENE_REQUIRED,
} from '@/lib/eza/mirror/vehicleSceneContract';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';
import { buildContextualHighlight } from '@/lib/eza/mirror/contextualHighlight';
import { resolvePosterPalette } from '@/lib/eza/mirror/posterPaletteSystem';
import { withDevVehicleCueHints } from '@/lib/eza/mirror/mirrorIntentContext';
import { buildMirrorState } from '@/lib/eza/mirror/mirrorStateEngine';

function bmwEntry(): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: 'bmw-12c',
    mode: 'standalone',
    savedAt: new Date().toISOString(),
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
    mirrorCueHints: ['bmw', 'mercedes', 'konfor', 'compare', 'hangisi'],
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

const BMW_ENTRIES = [bmwEntry(), bmwEntry(), bmwEntry()];

describe('vehicleSceneContract (Sprint 12C)', () => {
  it('defines required and forbidden tokens', () => {
    expect(VEHICLE_SCENE_REQUIRED).toContain('two premium executive sedans');
    expect(VEHICLE_SCENE_REQUIRED).toContain('showroom');
    expect(VEHICLE_SCENE_FORBIDDEN).toContain('city');
    expect(VEHICLE_SCENE_FORBIDDEN).toContain('street');
    expect(VEHICLE_SCENE_CONTRACT_ID).toBe('vehicle_comparison_showroom');
  });

  it('BMW/Mercedes prompt is director-led with composition contract near top', () => {
    const visual = buildMirrorVisualFromContext({
      entries: BMW_ENTRIES,
      characterName: 'Karar',
      personaFamilyId: 'decision_direction',
      seed: 'bmw-13b-director',
      storyVariant: 'compare',
      lockedIntent: 'premium_vehicle_comparison',
      intentFingerprint: 'fp-13b',
    });
    const openingIdx = visual.prompt.indexOf('COMPOSITION CONTRACT OPENING');
    const requiredIdx = visual.prompt.indexOf('REQUIRED OBJECTS');
    expect(openingIdx).toBeGreaterThanOrEqual(0);
    expect(requiredIdx).toBeGreaterThan(openingIdx);
    expect(visual.prompt.toLowerCase()).toContain('vehicle comparison');
    expect(visual.qualityHints.join(' ')).toMatch(/13B|director-led/);
  });

  it('BMW/Mercedes generated prompt passes hard contract', () => {
    const visual = buildMirrorVisualFromContext({
      entries: BMW_ENTRIES,
      characterName: 'Karar',
      personaFamilyId: 'decision_direction',
      seed: 'bmw-12c-contract',
      storyVariant: 'compare',
      storyTopicKey: 'general',
      lockedIntent: 'premium_vehicle_comparison',
      intentFingerprint: 'test-fp',
    });
    const p = visual.prompt.toLowerCase();
    for (const token of VEHICLE_SCENE_REQUIRED) {
      expect(p).toContain(token);
    }
    for (const bad of ['city', 'street', 'road', 'skyline', 'pier', 'dock', 'seascape']) {
      expect(p.includes(bad) && !p.includes(`no ${bad}`)).toBe(false);
    }
    expect(() => assertVehicleComparisonPrompt(visual.prompt)).not.toThrow();
    expect(visual.sceneContractId).toBe('vehicle_comparison_showroom');
  });

  it('fails contract when outdoor tokens injected', () => {
    const bad = 'two premium executive sedans showroom standing between comparison comfort decision city street road';
    const v = validateVehicleComparisonPrompt(bad);
    expect(v.ok).toBe(false);
    expect(v.forbidden.length).toBeGreaterThan(0);
  });

  it('buildMirrorState uses premium palette and dual_comparison highlight', () => {
    const state = buildMirrorState(withDevVehicleCueHints(BMW_ENTRIES), {
      seed: 'bmw-12c-state',
    });
    const card = state.dailyMirrorCard;
    expect(card.visual?.lockedPrimaryIntent).toBe('premium_vehicle_comparison');
    expect(resolvePosterPalette(card)).toBe('premium_light_editorial');
    const h = buildContextualHighlight(card);
    expect(h.kind).toBe('dual_comparison');
    expect(h.left?.label).toMatch(/BMW/i);
    expect(h.right?.label).toMatch(/Mercedes/i);
    expect(h.right?.hint).toMatch(/konfor/i);
    assertVehicleComparisonPrompt(card.visual!.prompt);
  });
});
