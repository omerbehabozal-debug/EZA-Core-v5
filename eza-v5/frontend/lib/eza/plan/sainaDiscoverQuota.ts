import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

export function canStartDiscoverFromEntitlements(
  snapshot: AccountEntitlementsResponse
): boolean {
  const { usage } = snapshot;
  if (usage.dailyDiscoverStartsLimit == null) return true;
  return usage.dailyDiscoverStartsUsed < usage.dailyDiscoverStartsLimit;
}
