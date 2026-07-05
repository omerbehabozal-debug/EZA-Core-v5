import { describe, expect, it } from 'vitest';
import {
  buildAccountUsageLines,
  formatAccountUsageValue,
  resolveUpgradeFeatureHint,
  shouldShowAccountUsageBanner,
} from '@/lib/eza/plan/sainaUsageSummary';
import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

function snapshot(
  overrides: Partial<AccountEntitlementsResponse> = {}
): AccountEntitlementsResponse {
  return {
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
      dailyMessagesUsed: 5,
      dailyMessagesLimit: 20,
      dailyDiscoverStartsUsed: 1,
      dailyDiscoverStartsLimit: 1,
      visualCreationsUsed: 0,
      visualCreationsLimit: 0,
      nextVisualAvailableAt: null,
    },
    ...overrides,
  };
}

describe('sainaUsageSummary', () => {
  it('builds message and discover usage lines', () => {
    const lines = buildAccountUsageLines(snapshot());
    expect(lines).toHaveLength(2);
    expect(lines[0]?.key).toBe('messages');
    expect(formatAccountUsageValue(lines[0]!)).toBe('5/20');
    expect(lines[1]?.atLimit).toBe(true);
  });

  it('includes visual line when mirror quota exists', () => {
    const lines = buildAccountUsageLines(
      snapshot({
        tier: 'premium',
        entitlements: {
          ...snapshot().entitlements,
          tier: 'premium',
          dailyMirrorLimit: 50,
        },
        usage: {
          ...snapshot().usage,
          visualCreationsUsed: 2,
          visualCreationsLimit: 50,
        },
      })
    );
    expect(lines.some((line) => line.key === 'visual')).toBe(true);
  });

  it('hides usage banner for premium tier', () => {
    expect(shouldShowAccountUsageBanner(snapshot())).toBe(true);
    expect(shouldShowAccountUsageBanner(snapshot({ tier: 'premium' }))).toBe(false);
  });

  it('resolves feature-specific upgrade hints', () => {
    expect(resolveUpgradeFeatureHint('saina_discover')).toMatch(/Keşfet/i);
    expect(resolveUpgradeFeatureHint('relationship_pattern')).toMatch(/İlişki haritası/i);
  });
});
