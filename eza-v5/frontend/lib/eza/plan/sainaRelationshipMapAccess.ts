import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import { RELATIONSHIP_PERIOD_OPTIONS } from '@/lib/eza/mirror/relationshipPatternMetrics';
import type { RelationshipPeriodFilter } from '@/lib/eza/relationshipMapModel';
import type { SainaGateOutcome } from '@/lib/eza/plan/sainaFeatureGate';
import type {
  AccountEntitlementsResponse,
  AccountTier,
  RelationshipMapAccess,
} from '@/lib/eza/plan/tierEntitlements';

const NINETY_DAY_MS = 90 * 24 * 60 * 60 * 1000;

export function getRelationshipMapAccess(
  snapshot: AccountEntitlementsResponse
): RelationshipMapAccess {
  return snapshot.entitlements.relationshipMapAccess;
}

export function canViewRelationshipMapData(access: RelationshipMapAccess): boolean {
  return access === 'last_90_days' || access === 'all';
}

export function gateRelationshipMapFromEntitlements(
  snapshot: AccountEntitlementsResponse
): SainaGateOutcome {
  const access = getRelationshipMapAccess(snapshot);
  if (canViewRelationshipMapData(access)) return 'allow';

  const tier = snapshot.tier;
  if (tier === 'guest') return 'auth_required';
  return 'upgrade_required';
}

export function getRelationshipPeriodOptionsForAccess(
  access: RelationshipMapAccess
): { value: RelationshipPeriodFilter; label: string }[] {
  if (access === 'all') return RELATIONSHIP_PERIOD_OPTIONS;
  return RELATIONSHIP_PERIOD_OPTIONS.filter((option) => option.value !== 'all');
}

export function clampRelationshipPeriodForAccess(
  period: RelationshipPeriodFilter,
  access: RelationshipMapAccess
): RelationshipPeriodFilter {
  if (access === 'last_90_days' && period === 'all') return 90;
  return period;
}

export function filterEntriesForMapAccess(
  entries: SavedBehavioralEntry[],
  access: RelationshipMapAccess,
  cutoffIso?: string | null
): SavedBehavioralEntry[] {
  if (access !== 'last_90_days') return entries;
  const cutoffMs = cutoffIso
    ? new Date(cutoffIso).getTime()
    : Date.now() - NINETY_DAY_MS;
  return entries.filter((entry) => new Date(entry.savedAt).getTime() >= cutoffMs);
}

export function resolveRelationshipMapAccessLabel(tier: AccountTier | string): string {
  if (tier === 'guest' || tier === 'anonymous') return 'locked';
  if (tier === 'mini') return 'last_90_days';
  if (tier === 'standard' || tier === 'premium') return 'all';
  return 'locked';
}
