import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  clearDailyMirrorSnapshot,
  computeEntrySignals,
  entriesForDisplayedMirror,
  hasNewDataSinceSnapshot,
  readTodaysSnapshot,
  resolveMirrorRefreshCta,
  saveDailyMirrorSnapshot,
} from '@/lib/eza/mirror/dailyMirrorSnapshot';

function entry(savedAt: string, id: string): SavedBehavioralEntry {
  return {
    savedAt,
    schema_version: 1,
    interaction_id: id,
    mode: 'standalone',
    vector: {
      input_risk: 0.2,
      output_risk: 0.15,
      input_health: 0.8,
      output_health: 0.85,
      alignment_score: null,
      eza_final: null,
      intent: '',
      alignment_verdict: null,
      redirect: false,
      redirect_reason: null,
      policy_violation_count: 0,
    },
    asymmetry: { health_gap: 0.05, risk_delta_output_minus_input: -0.05, index: 0.1 },
  };
}

const NOW = new Date('2026-06-01T12:00:00');

describe('dailyMirrorSnapshot', () => {
  beforeEach(() => {
    clearDailyMirrorSnapshot();
  });

  afterEach(() => {
    clearDailyMirrorSnapshot();
  });

  it('resolveMirrorRefreshCta is open_first when no snapshot today', () => {
    const entries = [entry('2026-06-01T10:00:00Z', 'a')];
    expect(resolveMirrorRefreshCta(entries, NOW)).toBe('open_first');
  });

  it('resolveMirrorRefreshCta is current when snapshot matches entries', () => {
    const entries = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T11:00:00Z', 'b'),
    ];
    saveDailyMirrorSnapshot(entries, '2026-06-01', NOW);
    expect(resolveMirrorRefreshCta(entries, NOW)).toBe('current');
    expect(hasNewDataSinceSnapshot(entries, readTodaysSnapshot(NOW), NOW)).toBe(false);
  });

  it('detects new data when entry count increases', () => {
    const base = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T11:00:00Z', 'b'),
    ];
    saveDailyMirrorSnapshot(base, '2026-06-01', NOW);
    const withNew = [...base, entry('2026-06-01T12:30:00Z', 'c')];
    expect(resolveMirrorRefreshCta(withNew, NOW)).toBe('update');
    expect(hasNewDataSinceSnapshot(withNew, readTodaysSnapshot(NOW), NOW)).toBe(true);
  });

  it('entriesForDisplayedMirror truncates when new data exists', () => {
    const base = [
      entry('2026-06-01T10:00:00Z', 'a'),
      entry('2026-06-01T11:00:00Z', 'b'),
    ];
    const snap = saveDailyMirrorSnapshot(base, '2026-06-01', NOW);
    const withNew = [...base, entry('2026-06-01T12:30:00Z', 'c')];
    const displayed = entriesForDisplayedMirror(withNew, snap, NOW);
    expect(displayed).toHaveLength(2);
    expect(displayed.map((e) => e.interaction_id)).toEqual(['a', 'b']);
  });

  it('ignores yesterday snapshot for today CTA', () => {
    const entries = [entry('2026-06-02T10:00:00Z', 'a')];
    saveDailyMirrorSnapshot(entries, '2026-06-01', new Date('2026-06-01T10:00:00'));
    expect(resolveMirrorRefreshCta(entries, new Date('2026-06-02T10:00:00'))).toBe('open_first');
  });

  it('computeEntrySignals picks latest savedAt', () => {
    const entries = [
      entry('2026-06-01T09:00:00Z', 'a'),
      entry('2026-06-01T11:00:00Z', 'b'),
    ];
    expect(computeEntrySignals(entries).latestEntryAt).toBe('2026-06-01T11:00:00Z');
    expect(computeEntrySignals(entries).entryCount).toBe(2);
  });
});
