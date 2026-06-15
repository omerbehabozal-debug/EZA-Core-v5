import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  buildRelationshipDashboardMetrics,
  buildGhostIslands,
  buildTimelinePoints,
  computeActiveTimeDistribution,
  computeInteractionDepth,
  islandBlobSizePx,
  normalizeIslandPercents,
  RELATIONSHIP_PERIOD_OPTIONS,
} from '@/lib/eza/mirror/relationshipPatternMetrics';

const patternViewSrc = readFileSync(
  join(process.cwd(), 'components/mirror/relationship/RelationshipPatternView.tsx'),
  'utf8'
);

function entry(id: string, savedAt: string, category = 'exploration'): SavedBehavioralEntry {
  return {
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    savedAt,
    vector: {
      input_risk: 0.1,
      output_risk: 0.1,
      input_health: 0.9,
      output_health: 0.9,
      alignment_score: 78,
      eza_final: 75,
      intent: 'test',
      alignment_verdict: 'aligned',
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0, risk_delta_output_minus_input: 0, index: 0 },
    standaloneObservation: {
      user_pattern: { category, confidence: 0.85, signals: [] },
      ai_behavior: { category: 'explanatory', confidence: 0.8, signals: [] },
      relationship_balance: { category: 'creative_flow', confidence: 0.8, signals: [] },
    },
  };
}

const now = Date.now();
const ENTRIES = [
  entry('1', new Date(now - 2 * 86400000).toISOString()),
  entry('2', new Date(now - 5 * 86400000).toISOString(), 'decision_support'),
  entry('3', new Date(now - 12 * 86400000).toISOString(), 'clarity_seek'),
  entry('4', new Date(now - 20 * 86400000).toISOString()),
];

describe('relationshipPatternMetrics', () => {
  it('normalizes island percents to ~100', () => {
    const normalized = normalizeIslandPercents([
      {
        id: 'a',
        label: 'A',
        percent: 40,
        color: '#fff',
        description: '',
        intensity: 0.8,
      },
      {
        id: 'b',
        label: 'B',
        percent: 40,
        color: '#000',
        description: '',
        intensity: 0.6,
      },
    ]);
    const sum = normalized.reduce((s, i) => s + i.percent, 0);
    expect(sum).toBe(100);
  });

  it('island blob size respects min/max', () => {
    expect(islandBlobSizePx(0)).toBeGreaterThanOrEqual(110);
    expect(islandBlobSizePx(100)).toBeLessThanOrEqual(210);
  });

  it('active time distribution returns four buckets', () => {
    const buckets = computeActiveTimeDistribution(ENTRIES);
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((s, b) => s + b.percent, 0)).toBe(100);
  });

  it('interaction depth empty fallback', () => {
    const depth = computeInteractionDepth([], [], 1, null);
    expect(depth.forming).toBe(true);
    expect(depth.score).toBeNull();
  });

  it('timeline points has three labels', () => {
    const points = buildTimelinePoints(ENTRIES, 30);
    expect(points).toHaveLength(3);
    expect(points[2]?.label).toBe('Bugün');
  });

  it('empty dashboard uses ghost islands', () => {
    const m = buildRelationshipDashboardMetrics([], 30);
    expect(m.isEmpty).toBe(true);
    expect(m.ghostIslands.length).toBeGreaterThan(0);
    expect(buildGhostIslands()[0]?.label).toContain('Keşif');
  });

  it('dashboard with data has islands and bars', () => {
    const m = buildRelationshipDashboardMetrics(ENTRIES, 30);
    expect(m.isEmpty).toBe(false);
    expect(m.islands.length).toBeGreaterThan(0);
    expect(m.aiBehaviorBars.length).toBe(6);
    expect(m.balanceBars.length).toBe(5);
  });

  it('period options include Tümü', () => {
    expect(RELATIONSHIP_PERIOD_OPTIONS.some((p) => p.value === 'all')).toBe(true);
  });
});

describe('RelationshipPatternView (14A)', () => {
  it('renders period filters 7/30/90/Tümü', () => {
    expect(patternViewSrc).toContain('RELATIONSHIP_PERIOD_OPTIONS');
    expect(RELATIONSHIP_PERIOD_OPTIONS.some((p) => p.label === 'Tümü')).toBe(true);
  });

  it('shows behavior islands section', () => {
    expect(patternViewSrc).toContain('Davranış Adaların');
    expect(patternViewSrc).toContain('BehaviorIslandsMap');
  });

  it('shows premium title İlişki Haritası', () => {
    expect(patternViewSrc).toContain('İlişki Haritası');
    expect(patternViewSrc).toContain('saina-pattern-page-title');
  });

  it('shows empty state copy', () => {
    expect(patternViewSrc).toContain('Desen henüz oluşmadı');
  });

  it('does not call OpenAI or generate-scene API', () => {
    expect(patternViewSrc).not.toContain('generateMirrorScene');
    expect(patternViewSrc).not.toContain('openai');
    expect(patternViewSrc).not.toContain('/api/');
  });

  it('hides frontend middle copy in favor of dashboard metrics only', () => {
    expect(patternViewSrc).toContain('buildRelationshipDashboardMetrics');
    expect(patternViewSrc).not.toContain('journeyHeadline');
  });
});
