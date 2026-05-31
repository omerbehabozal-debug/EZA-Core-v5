import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FREE_MIRROR_USAGE_STORAGE_KEY,
  canCreateFreeMirrorThisMonth,
  clearFreeMirrorUsage,
  formatNextFreeMirrorDate,
  markFreeMirrorUsed,
} from '@/lib/eza/plan/freeMirrorUsage';

describe('freeMirrorUsage', () => {
  beforeEach(() => {
    clearFreeMirrorUsage();
  });

  afterEach(() => {
    clearFreeMirrorUsage();
  });

  it('allows first mirror in a month', () => {
    expect(canCreateFreeMirrorThisMonth(new Date('2026-05-15'))).toBe(true);
  });

  it('blocks after monthly quota is consumed', () => {
    markFreeMirrorUsed('2026-05-15', new Date('2026-05-15T12:00:00'));
    expect(canCreateFreeMirrorThisMonth(new Date('2026-05-20'))).toBe(false);
  });

  it('resets quota when month changes', () => {
    markFreeMirrorUsed('2026-05-15', new Date('2026-05-15'));
    expect(canCreateFreeMirrorThisMonth(new Date('2026-06-01'))).toBe(true);
  });

  it('formats next free mirror date for June after May usage', () => {
    const next = formatNextFreeMirrorDate(new Date('2026-05-15'));
    expect(next.length).toBeGreaterThan(4);
    expect(next).toMatch(/2026/);
    expect(next.toLowerCase()).toMatch(/haziran|june|06/);
  });

  it('persists usage in localStorage', () => {
    markFreeMirrorUsed('2026-05-15', new Date('2026-05-15T10:00:00Z'));
    const raw = localStorage.getItem(FREE_MIRROR_USAGE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { used: boolean; monthKey: string };
    expect(parsed.used).toBe(true);
    expect(parsed.monthKey).toBe('2026-05');
  });
});
