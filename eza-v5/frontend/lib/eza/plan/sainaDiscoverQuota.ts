import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

export function canStartDiscoverFromEntitlements(
  snapshot: AccountEntitlementsResponse
): boolean {
  const { usage } = snapshot;
  return usage.dailyDiscoverStartsUsed < usage.dailyDiscoverStartsLimit;
}
