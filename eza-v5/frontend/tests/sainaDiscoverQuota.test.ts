import { describe, expect, it } from 'vitest';
import { canStartDiscoverFromEntitlements } from '@/lib/eza/plan/sainaDiscoverQuota';
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

describe('sainaDiscoverQuota', () => {
  it('allows discover start when under limit', () => {
    expect(canStartDiscoverFromEntitlements(baseSnapshot())).toBe(true);
  });

  it('blocks discover start when limit reached', () => {
    expect(
      canStartDiscoverFromEntitlements(
        baseSnapshot({
          usage: {
            ...baseSnapshot().usage,
            dailyDiscoverStartsUsed: 1,
            dailyDiscoverStartsLimit: 1,
          },
        })
      )
    ).toBe(false);
  });
});
