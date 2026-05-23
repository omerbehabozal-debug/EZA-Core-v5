import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildCompositionContract,
  buildScenePromptFromDirector,
} from '@/lib/eza/mirror/compositionContractBuilder';
import { deriveVisualNarrativeDirection } from '@/lib/eza/mirror/visualNarrativeDirector';
import { deriveReflectionSignals } from '@/lib/eza/mirror/reflectionSignals';
import { deriveConversationVisualIntent } from '@/lib/eza/mirror/conversationVisualIntent';
import { buildEmotionalSceneBlock } from '@/lib/eza/mirror/emotionalSceneEngine';
import { buildMirrorVisualFromContext } from '@/lib/eza/mirror/visualPromptEngine';

function entry(intent: string, signals: string[] = []): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `cc-${Math.random()}`,
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

const CALM_ENTRIES = [
  entry('reflect calm pause', ['calm', 'reflect']),
  entry('quiet thinking', ['notebook']),
  entry('gentle day', []),
];

const TRAVEL_ENTRIES = [
  entry('travel journey route', ['seyahat', 'rota', 'map']),
  entry('train station ticket', ['tren', 'ticket', 'journey']),
  entry('trip itinerary', ['harita']),
];

describe('compositionContractBuilder (Sprint 13B)', () => {
  it('BMW/Mercedes → requiredObjects includes two premium executive sedans', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const contract = buildCompositionContract(dir);
    expect(contract.requiredObjects.join(' ')).toContain('two premium executive sedans');
    expect(contract.requiredObjects).toContain('comparison board');
  });

  it('BMW/Mercedes → forbidden includes city street and pier', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const contract = buildCompositionContract(dir);
    expect(contract.forbiddenSceneTypes).toContain('city street');
    expect(contract.forbiddenSceneTypes).toContain('pier');
  });

  it('BMW/Mercedes promptOpening includes vehicle comparison', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const contract = buildCompositionContract(dir);
    expect(contract.promptOpening.toLowerCase()).toMatch(/vehicle comparison|comparison decision/);
  });

  it('calm reflection → requiredObjects includes notebook, tea, window', () => {
    const signals = deriveReflectionSignals(CALM_ENTRIES);
    const dir = deriveVisualNarrativeDirection({
      entries: CALM_ENTRIES,
      reflectionSignals: signals,
      reflectionTone: 'calm_reflective',
    });
    const contract = buildCompositionContract(dir);
    const joined = contract.requiredObjects.join(' ').toLowerCase();
    expect(joined).toMatch(/notebook/);
    expect(joined).toMatch(/tea/);
    expect(joined).toMatch(/window/);
  });

  it('travel → typographySafeZone exists', () => {
    const dir = deriveVisualNarrativeDirection({ entries: TRAVEL_ENTRIES });
    const contract = buildCompositionContract(dir);
    expect(contract.typographySafeZone.length).toBeGreaterThan(10);
  });

  it('prompt output includes upper-left typography safe area', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const intent = deriveConversationVisualIntent({
      entries: BMW_ENTRIES,
      topicKey: 'general',
      storyVariant: 'compare',
    });
    const emotional = buildEmotionalSceneBlock({
      intent,
      reflectionSignals: deriveReflectionSignals(BMW_ENTRIES),
      lockedIntent: 'premium_vehicle_comparison',
    });
    const { prompt } = buildScenePromptFromDirector({
      narrative: dir,
      topicKey: 'general',
      intent,
      emotionalBlock: emotional,
      reflectionSignals: deriveReflectionSignals(BMW_ENTRIES),
      atmosphereLabel: 'warm showroom calm',
      emotionLabel: 'analytical calm',
      lockedIntent: 'premium_vehicle_comparison',
    });
    expect(prompt.toLowerCase()).toContain('upper-left');
    expect(prompt.toLowerCase()).toContain('typography');
  });

  it('prompt output includes no text / no UI rule', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const intent = deriveConversationVisualIntent({ entries: BMW_ENTRIES, topicKey: 'general' });
    const emotional = buildEmotionalSceneBlock({
      intent,
      reflectionSignals: deriveReflectionSignals(BMW_ENTRIES),
      lockedIntent: 'premium_vehicle_comparison',
    });
    const { prompt } = buildScenePromptFromDirector({
      narrative: dir,
      topicKey: 'general',
      intent,
      emotionalBlock: emotional,
      reflectionSignals: deriveReflectionSignals(BMW_ENTRIES),
      atmosphereLabel: 'warm',
      emotionLabel: 'calm',
      lockedIntent: 'premium_vehicle_comparison',
    });
    expect(prompt.toLowerCase()).toMatch(/no text|no readable writing/);
    expect(prompt.toLowerCase()).toMatch(/no ui|ui overlay|generate ui|game ui/);
  });

  it('forbidden scene types are included in negative prompt', () => {
    const dir = deriveVisualNarrativeDirection({ entries: BMW_ENTRIES });
    const intent = deriveConversationVisualIntent({
      entries: BMW_ENTRIES,
      topicKey: 'general',
      storyVariant: 'compare',
    });
    const emotional = buildEmotionalSceneBlock({
      intent,
      reflectionSignals: deriveReflectionSignals(BMW_ENTRIES),
      lockedIntent: 'premium_vehicle_comparison',
    });
    const { negativePrompt } = buildScenePromptFromDirector({
      narrative: dir,
      topicKey: 'general',
      intent,
      emotionalBlock: emotional,
      reflectionSignals: deriveReflectionSignals(BMW_ENTRIES),
      atmosphereLabel: 'warm',
      emotionLabel: 'calm',
      lockedIntent: 'premium_vehicle_comparison',
    });
    const neg = negativePrompt.toLowerCase();
    expect(neg).toContain('city street');
    expect(neg).toContain('pier');
    expect(neg).toContain('seascape');
  });
});

describe('visualPromptEngine director pipeline (Sprint 13B)', () => {
  it('BMW/Mercedes prompt leads with composition contract before style canon', () => {
    const visual = buildMirrorVisualFromContext({
      entries: BMW_ENTRIES,
      characterName: 'Karar',
      personaFamilyId: 'decision_direction',
      seed: 'bmw-13b-order',
      storyVariant: 'compare',
      storyTopicKey: 'general',
      lockedIntent: 'premium_vehicle_comparison',
      intentFingerprint: 'fp-13b',
    });
    const openingIdx = visual.prompt.indexOf('COMPOSITION CONTRACT OPENING');
    const styleIdx = visual.prompt.indexOf('STYLE CANON');
    expect(openingIdx).toBeGreaterThanOrEqual(0);
    expect(styleIdx).toBeGreaterThan(openingIdx);
    expect(visual.prompt.toLowerCase()).toContain('two premium executive sedans');
  });

  it('BMW/Mercedes prompt avoids outdoor skeleton tokens in body', () => {
    const visual = buildMirrorVisualFromContext({
      entries: BMW_ENTRIES,
      characterName: 'Karar',
      personaFamilyId: 'decision_direction',
      seed: 'bmw-13b-forbidden',
      storyVariant: 'compare',
      lockedIntent: 'premium_vehicle_comparison',
      intentFingerprint: 'fp-13b',
    });
    const p = visual.prompt.toLowerCase();
    for (const bad of ['city street', 'pier', 'seascape', 'skyline', 'dock']) {
      expect(p.includes(bad) && !p.includes(`no ${bad}`)).toBe(false);
    }
  });

  it('calm reflection prompt includes notebook and window objects', () => {
    const visual = buildMirrorVisualFromContext({
      entries: CALM_ENTRIES,
      characterName: 'Sakin',
      personaFamilyId: 'balanced_calm',
      seed: 'calm-13b',
      reflectionTone: 'calm_reflective',
    });
    const p = visual.prompt.toLowerCase();
    expect(p).toContain('notebook');
    expect(p).toMatch(/tea|window/);
    expect(p).toContain('composition contract opening');
  });
});
