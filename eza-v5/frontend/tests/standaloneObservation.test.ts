import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  parseStandaloneObservation,
  mapBackendUserCategory,
  mapBackendAiCategory,
  resolveObservationSource,
} from '@/lib/standaloneObservation';
import { buildDailyObservationFromEntries } from '@/lib/eza/dailyObservation';
import { buildRelationshipMap } from '@/lib/eza/relationshipMapModel';
import { aiLineForBackendCategory, balanceLineForBackendCategory } from '@/lib/eza/presentationTone';

const SAMPLE_OBS = {
  user_pattern: {
    category: 'decision_direction',
    confidence: 0.72,
    signals: ['choice_comparison'],
  },
  ai_behavior: {
    category: 'explanatory',
    confidence: 0.81,
    signals: ['structured_answer'],
  },
  relationship_balance: {
    category: 'decision_balance',
    confidence: 0.76,
    signals: ['guidance_without_pressure'],
  },
  observation_quality: 'medium' as const,
  can_interpret: true,
  disclaimer: 'Test',
};

function makeEntry(
  overrides: Partial<SavedBehavioralEntry> & { standaloneObservation?: unknown }
): SavedBehavioralEntry {
  const { standaloneObservation, ...rest } = overrides;
  return {
    schema_version: 1,
    interaction_id: rest.interaction_id ?? `id-${Math.random()}`,
    mode: 'standalone',
    savedAt: rest.savedAt ?? new Date().toISOString(),
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 85,
      eza_final: 80,
      intent: 'greeting',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0.1 },
    ...rest,
    ...(standaloneObservation !== undefined ? { standaloneObservation } : {}),
  };
}

describe('parseStandaloneObservation', () => {
  it('parses valid payload', () => {
    const obs = parseStandaloneObservation(SAMPLE_OBS);
    expect(obs?.user_pattern.category).toBe('decision_direction');
    expect(obs?.ai_behavior.confidence).toBe(0.81);
  });

  it('returns null for invalid payload', () => {
    expect(parseStandaloneObservation(null)).toBeNull();
    expect(parseStandaloneObservation({ user_pattern: {} })).toBeNull();
  });
});

describe('category mapping', () => {
  it('maps known backend user categories', () => {
    expect(mapBackendUserCategory('decision_direction')).toBe('decision_support');
    expect(mapBackendUserCategory('clarity_simplification')).toBe('clarity_seek');
  });

  it('unknown category falls back to balanced', () => {
    expect(mapBackendUserCategory('not_a_real_category')).toBe('balanced');
  });

  it('maps backend ai protective to sensitive_balance', () => {
    expect(mapBackendAiCategory('protective')).toBe('sensitive_balance');
  });
});

describe('buildDailyObservationFromEntries priority', () => {
  it('uses backend observation when present', () => {
    const entries = [
      makeEntry({
        interaction_id: 'latest',
        standaloneObservation: SAMPLE_OBS,
        vector: {
          input_risk: 0.05,
          output_risk: 0.05,
          input_health: 0.95,
          output_health: 0.95,
          alignment_score: 90,
          eza_final: 90,
          intent: 'greeting',
          alignment_verdict: 'aligned',
          redirect: false,
          redirect_reason: null,
          policy_violation_count: 0,
        },
      }),
    ];
    const view = buildDailyObservationFromEntries(entries, { tone: 'standalone' });
    expect(view.categoryId).toBe('decision_support');
    expect(view.personaFamilyId).toBe('decision_direction');
    expect(view.aiLine).toMatch(/açıklayıcı|yapılandır/i);
    expect(view.balanceLine).toMatch(/Yön arayışına|Karar arayışı/i);
  });

  it('falls back to frontend aggregation without observation', () => {
    const entries = [
      makeEntry({
        interaction_id: 'a',
        vector: {
          input_risk: 0.05,
          output_risk: 0.05,
          input_health: 0.95,
          output_health: 0.95,
          alignment_score: 90,
          eza_final: 90,
          intent: 'greeting',
          alignment_verdict: 'aligned',
          redirect: false,
          redirect_reason: null,
          policy_violation_count: 0,
        },
      }),
    ];
    const view = buildDailyObservationFromEntries(entries, { tone: 'standalone' });
    expect(resolveObservationSource(entries)).toBe('fallback');
    expect(view.show).toBe(true);
    expect(view.categoryId).toBeDefined();
  });
});

describe('relationshipMapModel backend categories', () => {
  it('weights dominant pattern from backend tags', () => {
    const entries = [
      makeEntry({ standaloneObservation: SAMPLE_OBS }),
      makeEntry({
        standaloneObservation: {
          ...SAMPLE_OBS,
          user_pattern: { ...SAMPLE_OBS.user_pattern, category: 'ideation_creation' },
        },
      }),
    ];
    const map = buildRelationshipMap(entries, 30);
    expect(map.totalInteractions).toBe(2);
    expect(map.islands.length).toBeGreaterThan(0);
    const top = map.islands[0]!;
    expect(['Karar desteği', 'Fikir geliştirme']).toContain(top.label);
  });
});

describe('stream parser field', () => {
  it('reads standalone_observation from completion-shaped payload', () => {
    const completion = {
      done: true,
      assistant_score: 80,
      standalone_observation: SAMPLE_OBS,
    };
    const obs = parseStandaloneObservation(completion.standalone_observation);
    expect(obs?.relationship_balance.category).toBe('decision_balance');
  });
});

describe('backend copy lines', () => {
  it('explanatory and protective lines resolve', () => {
    expect(aiLineForBackendCategory('explanatory', 'standalone', 't')).toMatch(
      /açıklayıcı|yapılandır/i
    );
    expect(aiLineForBackendCategory('protective', 'standalone', 't')).toMatch(/güvenli/i);
    expect(balanceLineForBackendCategory('safe_balance', 'standalone', 't')).toMatch(/Hassas/i);
  });
});

describe('dev observation source log', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('logs only in development', async () => {
    const { logObservationSourceDev } = await import('@/lib/standaloneObservation');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logObservationSourceDev('backend', 'test');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
