/**
 * SAINA account tier entitlements — mirrors backend/core/account/tiers.py (PR1).
 */

export type AccountTier = 'guest' | 'free' | 'mini' | 'standard' | 'premium';

export type RelationshipMapAccess = 'locked' | 'last_90_days' | 'all';

export type ImageQuality = 'medium' | 'high' | 'highest';

export type TierEntitlements = {
  tier: AccountTier;
  dailyMessageLimit: number | null;
  maxMessageChars: number;
  mirrorCooldownHours: number | null;
  dailyMirrorLimit: number | null;
  dailyDiscoverStartLimit: number | null;
  relationshipMapAccess: RelationshipMapAccess;
  relationshipMapCutoffIso?: string | null;
  imageQuality: ImageQuality;
  priorityGeneration: boolean;
};

export type AccountUsageSnapshot = {
  dailyMessagesUsed: number;
  dailyMessagesLimit: number | null;
  dailyDiscoverStartsUsed: number;
  dailyDiscoverStartsLimit: number | null;
  visualCreationsUsed: number;
  visualCreationsLimit: number | null;
  nextVisualAvailableAt: string | null;
};

export type AccountEntitlementsResponse = {
  tier: AccountTier;
  label: string;
  entitlements: TierEntitlements;
  usage: AccountUsageSnapshot;
};

export const TIER_LABELS: Record<AccountTier, string> = {
  guest: 'SAINA Guest',
  free: 'SAINA Free',
  mini: 'SAINA Mini',
  standard: 'SAINA Standard',
  premium: 'SAINA Premium',
};

const PREMIUM_DAILY_MESSAGE_CAP = 5000;
const PREMIUM_DAILY_MIRROR_CAP = 50;
const PREMIUM_DAILY_DISCOVER_CAP = 200;

export const TIER_ENTITLEMENTS: Record<AccountTier, TierEntitlements> = {
  guest: {
    tier: 'guest',
    dailyMessageLimit: 10,
    maxMessageChars: 500,
    mirrorCooldownHours: null,
    dailyMirrorLimit: 1,
    dailyDiscoverStartLimit: 1,
    relationshipMapAccess: 'locked',
    imageQuality: 'medium',
    priorityGeneration: false,
  },
  free: {
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
  mini: {
    tier: 'mini',
    dailyMessageLimit: 50,
    maxMessageChars: 800,
    mirrorCooldownHours: 48,
    dailyMirrorLimit: null,
    dailyDiscoverStartLimit: 10,
    relationshipMapAccess: 'last_90_days',
    imageQuality: 'medium',
    priorityGeneration: false,
  },
  standard: {
    tier: 'standard',
    dailyMessageLimit: 100,
    maxMessageChars: 2000,
    mirrorCooldownHours: null,
    dailyMirrorLimit: 1,
    dailyDiscoverStartLimit: 20,
    relationshipMapAccess: 'all',
    imageQuality: 'high',
    priorityGeneration: true,
  },
  premium: {
    tier: 'premium',
    dailyMessageLimit: PREMIUM_DAILY_MESSAGE_CAP,
    maxMessageChars: 16000,
    mirrorCooldownHours: null,
    dailyMirrorLimit: PREMIUM_DAILY_MIRROR_CAP,
    dailyDiscoverStartLimit: PREMIUM_DAILY_DISCOVER_CAP,
    relationshipMapAccess: 'all',
    imageQuality: 'highest',
    priorityGeneration: true,
  },
};

/** Map legacy planStore mirror_plan to account tier (until entitlements API is primary). */
export function mapMirrorPlanToAccountTier(
  mirrorPlan: 'free' | 'plus' | null | undefined,
  isAuthenticated: boolean
): AccountTier {
  if (!isAuthenticated) return 'guest';
  return mirrorPlan === 'plus' ? 'premium' : 'free';
}

export function getEntitlementsForTier(tier: AccountTier): TierEntitlements {
  return { ...TIER_ENTITLEMENTS[tier] };
}

export function buildStubUsage(entitlements: TierEntitlements): AccountUsageSnapshot {
  return {
    dailyMessagesUsed: 0,
    dailyMessagesLimit: entitlements.dailyMessageLimit,
    dailyDiscoverStartsUsed: 0,
    dailyDiscoverStartsLimit: entitlements.dailyDiscoverStartLimit,
    visualCreationsUsed: 0,
    visualCreationsLimit: entitlements.dailyMirrorLimit,
    nextVisualAvailableAt: null,
  };
}
