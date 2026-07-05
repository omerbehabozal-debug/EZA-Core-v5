import { describe, expect, it } from 'vitest';
import {
  TIER_ENTITLEMENTS,
  TIER_LABELS,
  buildStubUsage,
  getEntitlementsForTier,
  mapMirrorPlanToAccountTier,
} from '@/lib/eza/plan/tierEntitlements';

describe('tierEntitlements', () => {
  it('defines all five tiers with labels', () => {
    expect(Object.keys(TIER_ENTITLEMENTS).sort()).toEqual([
      'free',
      'guest',
      'mini',
      'premium',
      'standard',
    ]);
    expect(TIER_LABELS.guest).toBe('SAINA Guest');
    expect(TIER_LABELS.premium).toBe('SAINA Premium');
  });

  it('maps legacy mirror_plan to account tier', () => {
    expect(mapMirrorPlanToAccountTier(null, false)).toBe('guest');
    expect(mapMirrorPlanToAccountTier('free', true)).toBe('free');
    expect(mapMirrorPlanToAccountTier('plus', true)).toBe('premium');
  });

  it('matches product spec highlights per tier', () => {
    expect(getEntitlementsForTier('guest').dailyMessageLimit).toBe(10);
    expect(getEntitlementsForTier('free').dailyMirrorLimit).toBe(0);
    expect(getEntitlementsForTier('mini').mirrorCooldownHours).toBe(48);
    expect(getEntitlementsForTier('standard').dailyMirrorLimit).toBe(1);
    expect(getEntitlementsForTier('premium').dailyMessageLimit).toBeGreaterThan(1000);
  });

  it('builds stub usage from entitlements', () => {
    const entitlements = getEntitlementsForTier('free');
    expect(buildStubUsage(entitlements)).toEqual({
      dailyMessagesUsed: 0,
      dailyMessagesLimit: 20,
      dailyDiscoverStartsUsed: 0,
      dailyDiscoverStartsLimit: 1,
      visualCreationsUsed: 0,
      visualCreationsLimit: 0,
      nextVisualAvailableAt: null,
    });
  });
});
