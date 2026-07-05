import { describe, expect, it } from 'vitest';
import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  canViewRelationshipMapData,
  clampRelationshipPeriodForAccess,
  filterEntriesForMapAccess,
  gateRelationshipMapFromEntitlements,
  getRelationshipPeriodOptionsForAccess,
} from '@/lib/eza/plan/sainaRelationshipMapAccess';
import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

function snapshotForAccess(
  access: AccountEntitlementsResponse['entitlements']['relationshipMapAccess'],
  tier: AccountEntitlementsResponse['tier'] = 'free'
): AccountEntitlementsResponse {
  return {
    tier,
    label: `SAINA ${tier}`,
    entitlements: {
      tier,
      dailyMessageLimit: 20,
      maxMessageChars: 500,
      mirrorCooldownHours: null,
      dailyMirrorLimit: 0,
      dailyDiscoverStartLimit: 1,
      relationshipMapAccess: access,
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
  };
}

function entryAt(daysAgo: number): SavedBehavioralEntry {
  return {
    savedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    snapshot: {
      userScore: 80,
      assistantScore: 85,
      userCategory: 'curiosity_exploration',
      aiCategory: 'explanatory',
    },
  };
}

describe('sainaRelationshipMapAccess', () => {
  it('locks guest and free tiers to preview', () => {
    expect(canViewRelationshipMapData('locked')).toBe(false);
    expect(gateRelationshipMapFromEntitlements(snapshotForAccess('locked', 'guest'))).toBe(
      'auth_required'
    );
    expect(gateRelationshipMapFromEntitlements(snapshotForAccess('locked', 'free'))).toBe(
      'upgrade_required'
    );
  });

  it('allows mini and standard tiers with data access', () => {
    expect(canViewRelationshipMapData('last_90_days')).toBe(true);
    expect(canViewRelationshipMapData('all')).toBe(true);
    expect(gateRelationshipMapFromEntitlements(snapshotForAccess('last_90_days', 'mini'))).toBe(
      'allow'
    );
    expect(gateRelationshipMapFromEntitlements(snapshotForAccess('all', 'standard'))).toBe('allow');
  });

  it('hides all-time period for last_90_days access', () => {
    const options = getRelationshipPeriodOptionsForAccess('last_90_days');
    expect(options.some((option) => option.value === 'all')).toBe(false);
    expect(options.some((option) => option.value === 90)).toBe(true);
    expect(clampRelationshipPeriodForAccess('all', 'last_90_days')).toBe(90);
  });

  it('filters entries older than 90 days for mini access', () => {
    const entries = [entryAt(10), entryAt(120)];
    const filtered = filterEntriesForMapAccess(entries, 'last_90_days');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.savedAt).toBe(entries[0]?.savedAt);
  });
});
