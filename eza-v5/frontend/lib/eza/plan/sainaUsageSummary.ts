import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';
import {
  SAINA_USAGE_DISCOVER_LABEL,
  SAINA_USAGE_MESSAGES_LABEL,
  SAINA_USAGE_VISUAL_LABEL,
  SAINA_UPGRADE_FEATURE_HINT_DISCOVER,
  SAINA_UPGRADE_FEATURE_HINT_MESSAGES,
  SAINA_UPGRADE_FEATURE_HINT_PATTERN,
  SAINA_UPGRADE_FEATURE_HINT_VISUAL,
} from '@/lib/eza/sainaCopy';

export type AccountUsageLine = {
  key: 'messages' | 'discover' | 'visual';
  label: string;
  used: number;
  limit: number | null;
  atLimit: boolean;
};

export function buildAccountUsageLines(
  snapshot: AccountEntitlementsResponse
): AccountUsageLine[] {
  const { usage, entitlements } = snapshot;
  const lines: AccountUsageLine[] = [
    {
      key: 'messages',
      label: SAINA_USAGE_MESSAGES_LABEL,
      used: usage.dailyMessagesUsed,
      limit: usage.dailyMessagesLimit,
      atLimit:
        usage.dailyMessagesLimit != null &&
        usage.dailyMessagesUsed >= usage.dailyMessagesLimit,
    },
    {
      key: 'discover',
      label: SAINA_USAGE_DISCOVER_LABEL,
      used: usage.dailyDiscoverStartsUsed,
      limit: usage.dailyDiscoverStartsLimit,
      atLimit:
        usage.dailyDiscoverStartsLimit != null &&
        usage.dailyDiscoverStartsUsed >= usage.dailyDiscoverStartsLimit,
    },
  ];

  if (entitlements.dailyMirrorLimit !== 0) {
    lines.push({
      key: 'visual',
      label: SAINA_USAGE_VISUAL_LABEL,
      used: usage.visualCreationsUsed,
      limit: usage.visualCreationsLimit,
      atLimit:
        usage.visualCreationsLimit != null &&
        usage.visualCreationsUsed >= usage.visualCreationsLimit,
    });
  }

  return lines;
}

export function formatAccountUsageValue(line: AccountUsageLine): string {
  if (line.limit == null) return String(line.used);
  return `${line.used}/${line.limit}`;
}

export function shouldShowAccountUsageBanner(
  snapshot: AccountEntitlementsResponse
): boolean {
  return snapshot.tier !== 'premium';
}

export function resolveUpgradeFeatureHint(feature?: string): string | null {
  if (!feature) return null;
  if (feature.includes('discover')) return SAINA_UPGRADE_FEATURE_HINT_DISCOVER;
  if (feature.includes('pattern') || feature.includes('relationship')) {
    return SAINA_UPGRADE_FEATURE_HINT_PATTERN;
  }
  if (feature.includes('visual') || feature.includes('mirror')) {
    return SAINA_UPGRADE_FEATURE_HINT_VISUAL;
  }
  if (feature.includes('message') || feature.includes('chat') || feature.includes('sidebar')) {
    return SAINA_UPGRADE_FEATURE_HINT_MESSAGES;
  }
  return null;
}
