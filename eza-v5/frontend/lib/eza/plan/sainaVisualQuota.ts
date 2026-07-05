import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

export function canCreateVisualFromEntitlements(
  snapshot: AccountEntitlementsResponse
): boolean {
  const { entitlements, usage } = snapshot;
  if (entitlements.dailyMirrorLimit === 0) return false;
  if (usage.nextVisualAvailableAt) return false;
  if (
    usage.visualCreationsLimit != null &&
    usage.visualCreationsUsed >= usage.visualCreationsLimit
  ) {
    return false;
  }
  return true;
}

export function formatVisualCooldownRemaining(nextAvailableAt: string): string {
  const target = new Date(nextAvailableAt);
  const diffMs = Math.max(0, target.getTime() - Date.now());
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours <= 1) return '1 saat';
  return `${hours} saat`;
}
