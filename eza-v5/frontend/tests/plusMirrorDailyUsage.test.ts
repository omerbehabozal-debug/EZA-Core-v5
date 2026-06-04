import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PLUS_MIRROR_DAILY_PRODUCTION_LIMIT,
  PLUS_MIRROR_DAILY_USAGE_STORAGE_KEY,
  canConsumePlusMirrorProduction,
  clearPlusMirrorDailyUsage,
  consumePlusMirrorProduction,
  formatPlusMirrorQuotaHint,
  getPlusMirrorProductionRemaining,
  getPlusMirrorProductionUsed,
} from '@/lib/eza/plan/plusMirrorDailyUsage';

const DAY = new Date('2026-06-01T12:00:00');

describe('plusMirrorDailyUsage', () => {
  beforeEach(() => {
    clearPlusMirrorDailyUsage();
  });

  afterEach(() => {
    clearPlusMirrorDailyUsage();
  });

  it('starts with full daily production quota', () => {
    expect(getPlusMirrorProductionRemaining(DAY)).toBe(PLUS_MIRROR_DAILY_PRODUCTION_LIMIT);
    expect(canConsumePlusMirrorProduction(DAY)).toBe(true);
  });

  it('increments used for create, update, and new scene', () => {
    expect(consumePlusMirrorProduction('create_card', DAY)).toBe(true);
    expect(consumePlusMirrorProduction('update_mirror', DAY)).toBe(true);
    expect(consumePlusMirrorProduction('new_scene', DAY)).toBe(true);
    expect(getPlusMirrorProductionUsed(DAY)).toBe(3);
    expect(getPlusMirrorProductionRemaining(DAY)).toBe(7);
  });

  it('blocks production when limit reached', () => {
    for (let i = 0; i < PLUS_MIRROR_DAILY_PRODUCTION_LIMIT; i += 1) {
      expect(consumePlusMirrorProduction('new_scene', DAY)).toBe(true);
    }
    expect(canConsumePlusMirrorProduction(DAY)).toBe(false);
    expect(consumePlusMirrorProduction('create_card', DAY)).toBe(false);
  });

  it('resets on next calendar day', () => {
    for (let i = 0; i < PLUS_MIRROR_DAILY_PRODUCTION_LIMIT; i += 1) {
      consumePlusMirrorProduction('create_card', DAY);
    }
    expect(canConsumePlusMirrorProduction(new Date('2026-06-02T08:00:00'))).toBe(true);
  });

  it('persists action log in localStorage', () => {
    consumePlusMirrorProduction('create_card', DAY);
    const raw = localStorage.getItem(PLUS_MIRROR_DAILY_USAGE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { used: number; actions: { type: string }[] };
    expect(parsed.used).toBe(1);
    expect(parsed.actions[0]?.type).toBe('create_card');
  });

  it('formatPlusMirrorQuotaHint reflects remaining', () => {
    expect(formatPlusMirrorQuotaHint(0)).toMatch(/paylaşabilir/i);
    expect(formatPlusMirrorQuotaHint(7)).toMatch(/7 üretim/i);
  });
});
