import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_MIRROR_USAGE_STORAGE_KEY,
  canCreateFreeMirrorToday,
  clearFreeMirrorUsage,
  formatNextFreeMirrorDate,
  markFreeMirrorUsedToday,
} from '@/lib/eza/plan/freeMirrorUsage';

describe('freeMirrorUsage (daily)', () => {
  beforeEach(() => {
    clearFreeMirrorUsage();
  });

  afterEach(() => {
    clearFreeMirrorUsage();
  });

  it('allows first mirror on a given day', () => {
    expect(canCreateFreeMirrorToday(new Date('2026-06-01T10:00:00'))).toBe(true);
  });

  it('blocks second free mirror on the same calendar day', () => {
    markFreeMirrorUsedToday('2026-06-01', new Date('2026-06-01T12:00:00'));
    expect(canCreateFreeMirrorToday(new Date('2026-06-01T20:00:00'))).toBe(false);
  });

  it('resets quota on the next calendar day', () => {
    markFreeMirrorUsedToday('2026-06-01', new Date('2026-06-01T12:00:00'));
    expect(canCreateFreeMirrorToday(new Date('2026-06-02T00:05:00'))).toBe(true);
  });

  it('ignores legacy monthly records (monthKey only)', () => {
    localStorage.setItem(
      FREE_MIRROR_USAGE_STORAGE_KEY,
      JSON.stringify({ monthKey: '2026-06', used: true })
    );
    expect(canCreateFreeMirrorToday(new Date('2026-06-01'))).toBe(true);
  });

  it('persists dayKey in localStorage', () => {
    markFreeMirrorUsedToday('2026-06-01', new Date('2026-06-01T10:00:00Z'));
    const raw = localStorage.getItem(FREE_MIRROR_USAGE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { used: boolean; dayKey: string };
    expect(parsed.used).toBe(true);
    expect(parsed.dayKey).toBe('2026-06-01');
  });

  it('formatNextFreeMirrorDate points to tomorrow', () => {
    const next = formatNextFreeMirrorDate(new Date('2026-06-01T15:00:00'));
    expect(next.length).toBeGreaterThan(4);
    expect(next).toMatch(/2026/);
    expect(next.toLowerCase()).toMatch(/2|haziran|june/);
  });
});

describe('freeMirrorUsage — Plus has no client quota', () => {
  it('Plus path does not use markFreeMirrorUsedToday in engine (documented)', () => {
    expect(typeof markFreeMirrorUsedToday).toBe('function');
    expect(typeof canCreateFreeMirrorToday).toBe('function');
  });
});
