import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  extractStoryCueTokens,
  extractVehicleMirrorCueHints,
  mapStoryTopicToSceneTopic,
  resolveStoryTopics,
} from '@/lib/eza/mirror/storyTopicResolver';
import { inferSceneTopicKey } from '@/lib/eza/mirror/visualPromptEngine';
import { resolveLockedPrimaryIntent } from '@/lib/eza/mirror/intentLockSystem';
import { MAX_CUE_TOKENS_AGGREGATE, MAX_CUE_TOKENS_PER_TURN } from '@/lib/eza/mirror/storyTopicCueRegistry';

function entry(
  mirrorCueHints: string[],
  savedAt = '2026-06-07T12:00:00.000Z'
): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: `id-${Math.random()}`,
    mode: 'standalone',
    savedAt,
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 80,
      eza_final: 75,
      intent: '',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    mirrorCueHints,
  };
}

describe('extractStoryCueTokens', () => {
  it('captures Uzbekistan travel cues', () => {
    const tokens = extractStoryCueTokens("Özbekistan'da nereler gezilir? Semerkant ve Buhara");
    expect(tokens).toContain('özbekistan');
    expect(tokens).toContain('semerkant');
    expect(tokens).toContain('buhara');
    expect(tokens.length).toBeLessThanOrEqual(MAX_CUE_TOKENS_PER_TURN);
  });

  it('captures food follow-up ne yiyebilirim', () => {
    const tokens = extractStoryCueTokens('İtalya gezisinde ne yiyebilirim?');
    expect(tokens).toContain('yemek');
  });

  it('captures architecture restoration cues', () => {
    const tokens = extractStoryCueTokens('Cami cephesi restorasyonu için malzeme öner');
    expect(tokens).toContain('restorasyon');
    expect(tokens).toContain('cephe');
    expect(tokens).toContain('cami');
  });

  it('captures technology_ai cues', () => {
    const tokens = extractStoryCueTokens('EZA ve Cursor ile AI ürün stratejisi');
    expect(tokens).toContain('eza');
    expect(tokens).toContain('cursor');
    expect(tokens).toContain('ürün');
  });

  it('does not store raw sentences as tokens', () => {
    const tokens = extractStoryCueTokens(
      'Bu çok uzun bir cümle olmalı ve whitelist dışı kalmalı'
    );
    for (const t of tokens) {
      expect(t.length).toBeLessThanOrEqual(24);
      expect(t).not.toContain('cümle');
    }
  });
});

describe('extractVehicleMirrorCueHints', () => {
  it('keeps BMW/Mercedes vehicle subset for lock', () => {
    const hints = extractVehicleMirrorCueHints(
      'BMW 3 Serisi ile Mercedes C arasında konfor için hangisini seçmeliyim?'
    );
    expect(hints).toContain('bmw');
    expect(hints).toContain('mercedes');
    expect(hints).toContain('konfor');
    expect(hints).toContain('hangisi');
  });
});

describe('resolveStoryTopics', () => {
  it('resolves travel for Uzbekistan + rota entries', () => {
    const resolution = resolveStoryTopics([
      entry(['özbekistan', 'semerkant'], '2026-06-07T10:00:00.000Z'),
      entry(['rota'], '2026-06-07T11:00:00.000Z'),
    ]);
    expect(resolution.primaryTopic).toBe('travel');
    expect(resolution.cueTokens.length).toBeLessThanOrEqual(MAX_CUE_TOKENS_AGGREGATE);
  });

  it('resolves vehicle for BMW vs Mercedes', () => {
    const resolution = resolveStoryTopics([
      entry(['bmw', 'mercedes', 'konfor', 'hangisi', 'vs']),
    ]);
    expect(resolution.primaryTopic).toBe('vehicle');
  });

  it('resolves architecture for restorasyon/cephe', () => {
    const resolution = resolveStoryTopics([entry(['restorasyon', 'cephe', 'mimari'])]);
    expect(resolution.primaryTopic).toBe('architecture');
  });

  it('resolves technology_ai for EZA/Cursor', () => {
    const resolution = resolveStoryTopics([entry(['eza', 'cursor', 'ürün'])]);
    expect(resolution.primaryTopic).toBe('technology_ai');
  });

  it('resolves food_culture for yemek/tarif', () => {
    const resolution = resolveStoryTopics([entry(['yemek', 'tarif', 'mutfak'])]);
    expect(resolution.primaryTopic).toBe('food_culture');
  });

  it('falls back to general_curiosity when empty', () => {
    const resolution = resolveStoryTopics([]);
    expect(resolution.primaryTopic).toBe('general_curiosity');
    expect(resolution.source).toBe('fallback');
  });
});

describe('mapStoryTopicToSceneTopic', () => {
  it('maps story topics to scene presets', () => {
    expect(mapStoryTopicToSceneTopic('travel')).toBe('travel');
    expect(mapStoryTopicToSceneTopic('architecture')).toBe('architecture');
    expect(mapStoryTopicToSceneTopic('vehicle')).toBe('general');
    expect(mapStoryTopicToSceneTopic('technology_ai')).toBe('creativity');
    expect(mapStoryTopicToSceneTopic('food_culture')).toBe('health');
    expect(mapStoryTopicToSceneTopic('family')).toBe('friendship');
  });
});

describe('inferSceneTopicKey integration', () => {
  it('prefers story resolver over persona finance bias', () => {
    const topic = inferSceneTopicKey(
      [entry(['özbekistan', 'rota'])],
      'decision_support',
      'decision_direction'
    );
    expect(topic).toBe('travel');
  });

  it('vehicle lock still works with vehicle cue entries', () => {
    const entries = [
      entry(['bmw', 'mercedes', 'konfor', 'hangisi', 'vs']),
      entry(['karar'], '2026-06-07T11:00:00.000Z'),
    ];
    expect(resolveLockedPrimaryIntent({ entries })).toBe('premium_vehicle_comparison');
    expect(inferSceneTopicKey(entries, 'balanced', 'balanced_calm')).toBe('general');
  });
});
