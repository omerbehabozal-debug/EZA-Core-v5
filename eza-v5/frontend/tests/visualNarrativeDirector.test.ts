import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  applyReflectionToneToNarrative,
  deriveVisualNarrativeDirection,
  resolveNarrativeArchetypeId,
} from '@/lib/eza/mirror/visualNarrativeDirector';
import { deriveReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';

function entry(intent: string, signals: string[] = []): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `vn-${Math.random()}`,
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
    mirrorCueHints: signals,
    standaloneObservation: {
      user_pattern: { category: 'decision_direction', confidence: 0.85, signals },
      ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
      relationship_balance: { category: 'decision_balance', confidence: 0.8, signals: [] },
    },
  };
}

const BMW_ENTRIES = [
  entry('bmw mercedes konfor compare', ['bmw', 'mercedes', 'konfor', 'hangisi', 'compare']),
  entry('compare comfort sedan', ['bmw', 'mercedes', 'uzun yol']),
  entry('which car', ['tercih', 'karar']),
];

const RESTORATION_ENTRIES = [
  entry('restoration stone material sketch', ['stone', 'restoration', 'malzeme', 'sketch']),
  entry('heritage courtyard', ['restorasyon', 'örnek']),
  entry('facade material', ['mimari']),
];

const FOOD_ENTRIES = [
  entry('gluten free dessert recipe', ['gluten', 'recipe', 'mutfak', 'tarif']),
  entry('cook kitchen', ['yemek', 'berries']),
  entry('nutrition', ['beslen']),
];

const TRAVEL_ENTRIES = [
  entry('travel journey route', ['seyahat', 'rota', 'map']),
  entry('train station ticket', ['tren', 'ticket', 'journey']),
  entry('trip itinerary', ['harita']),
];

const CALM_ENTRIES = [
  entry('reflect calm pause', ['calm', 'reflect']),
  entry('quiet thinking', ['notebook']),
  entry('gentle day', []),
];

describe('visualNarrativeDirector (Sprint 13A)', () => {
  it('BMW/Mercedes → luxury comparison studio', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    expect(dir.sceneArchetype).toBe('luxury comparison studio');
    expect(resolveNarrativeArchetypeId({ entries: BMW_ENTRIES })).toBe(
      'luxury_comparison_studio'
    );
  });

  it('BMW/Mercedes → heroObjects includes two premium executive sedans', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    expect(dir.heroObjects.join(' ')).toContain('two premium executive sedans');
    expect(dir.heroObjects).toContain('comparison board');
  });

  it('BMW/Mercedes → forbidden includes city street and pier', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    expect(dir.forbiddenSceneTypes).toContain('city street');
    expect(dir.forbiddenSceneTypes).toContain('pier');
    expect(dir.forbiddenSceneTypes).toContain('seascape');
  });

  it('restoration → stone samples and sketches', () => {
    const dir = deriveVisualNarrativeDirection({ entries: RESTORATION_ENTRIES });
    expect(dir.sceneArchetype).toBe('restoration material study');
    expect(dir.heroObjects.join(' ')).toMatch(/stone samples/);
    expect(dir.heroObjects.join(' ')).toMatch(/sketches/);
    expect(dir.environment).toMatch(/atelier|courtyard/i);
  });

  it('food → culinary preparation', () => {
    const dir = deriveVisualNarrativeDirection({ entries: FOOD_ENTRIES });
    expect(dir.sceneArchetype).toBe('warm culinary wellness preparation');
    expect(dir.heroObjects.join(' ')).toMatch(/mixing bowl|berries|gluten-free/i);
    expect(dir.environment).toMatch(/kitchen/i);
  });

  it('travel → map, ticket, train', () => {
    const dir = deriveVisualNarrativeDirection({ entries: TRAVEL_ENTRIES });
    expect(dir.sceneArchetype).toBe('journey planning threshold');
    expect(dir.heroObjects).toContain('map');
    expect(dir.heroObjects).toContain('ticket');
    expect(dir.heroObjects.join(' ')).toMatch(/train/);
  });

  it('calm reflection → notebook, window, tea', () => {
    const signals = deriveReflectionSignals(CALM_ENTRIES);
    const dir = deriveVisualNarrativeDirection({
      entries: CALM_ENTRIES,
      reflectionSignals: signals,
      reflectionTone: 'calm_reflective',
    });
    expect(dir.sceneArchetype).toBe('quiet reflective threshold');
    expect(dir.heroObjects).toContain('open notebook');
    expect(dir.heroObjects).toContain('tea cup');
    expect(dir.heroObjects.join(' ')).toMatch(/window/);
    expect(dir.visualDensity).toBe('sparse');
  });

  it('calm tone does not override vehicle scene archetype', () => {
    const signals = deriveReflectionSignals(BMW_ENTRIES);
    const dir = deriveVisualNarrativeDirection({
      entries: BMW_ENTRIES,
      reflectionSignals: signals,
      reflectionTone: 'calm_reflective',
    });
    expect(dir.sceneArchetype).toBe('luxury comparison studio');
    expect(dir.environment).toMatch(/showroom|garage/i);
    expect(dir.visualEmotion).toMatch(/softened|calm/i);
  });

  it('applyReflectionToneToNarrative preserves sceneArchetype', () => {
    const base = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const toned = applyReflectionToneToNarrative(
      base,
      'calm_reflective',
      deriveReflectionSignals(BMW_ENTRIES)
    );
    expect(toned.sceneArchetype).toBe('luxury comparison studio');
    expect(toned.heroObjects).toEqual(base.heroObjects);
  });

  it('produces typography safe zone and composition intent', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    expect(dir.typographySafeZone.length).toBeGreaterThan(20);
    expect(dir.typographySafeZone).toMatch(/upper-left|negative space/i);
    expect(dir.compositionIntent.length).toBeGreaterThan(5);
    expect(dir.characterRole.length).toBeGreaterThan(5);
  });
});
