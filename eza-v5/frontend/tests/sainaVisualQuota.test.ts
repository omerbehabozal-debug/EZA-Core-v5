import { describe, expect, it } from 'vitest';
import { canCreateVisualFromEntitlements, formatVisualCooldownRemaining } from '@/lib/eza/plan/sainaVisualQuota';
import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

const baseSnapshot = (
  overrides: Partial<AccountEntitlementsResponse> = {}
): AccountEntitlementsResponse => ({
  tier: 'free',
  label: 'SAINA Free',
  entitlements: {
    tier: 'free',
    dailyMessageLimit: 20,
    maxMessageChars: 500,
    mirrorCooldownHours: null,
    dailyMirrorLimit: 0,
    dailyDiscoverStartLimit: 1,
    relationshipMapAccess: 'locked',
    imageQuality: 'medium',
    priorityGeneration: false,
  },
  usage: {
    dailyMessagesUsed: 0,
    dailyMessagesLimit: 20,
    dailyDiscoverStartsUsed: 0,
    dailyDiscoverStartsLimit: 1,
    visualCreationsUsed: 0,
    visualCreationsLimit: 0,
    nextVisualAvailableAt: null,
  },
  ...overrides,
});

describe('sainaVisualQuota', () => {
  it('blocks free tier visual creation', () => {
    expect(canCreateVisualFromEntitlements(baseSnapshot())).toBe(false);
  });

  it('allows premium when under limit', () => {
    const snapshot = baseSnapshot({
      tier: 'premium',
      entitlements: {
        ...baseSnapshot().entitlements,
        tier: 'premium',
        dailyMirrorLimit: 50,
      },
      usage: {
        ...baseSnapshot().usage,
        visualCreationsLimit: 50,
        visualCreationsUsed: 2,
      },
    });
    expect(canCreateVisualFromEntitlements(snapshot)).toBe(true);
  });

  it('formats cooldown hours', () => {
    const future = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
    expect(formatVisualCooldownRemaining(future)).toMatch(/saat/);
  });
});
