/**
 * Fetch SAINA account entitlements from backend (usage rollup via X-Guest-Token).
 */

import { apiClient } from '@/lib/apiClient';
import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';
import type {
  AccountEntitlementsResponse,
  AccountTier,
  AccountUsageSnapshot,
  TierEntitlements,
} from '@/lib/eza/plan/tierEntitlements';

function normalizeTier(raw: string | undefined): AccountTier {
  if (
    raw === 'guest' ||
    raw === 'free' ||
    raw === 'mini' ||
    raw === 'standard' ||
    raw === 'premium'
  ) {
    return raw;
  }
  return 'guest';
}

function normalizeEntitlements(raw: Record<string, unknown> | undefined): TierEntitlements | null {
  if (!raw || typeof raw !== 'object') return null;
  const tier = normalizeTier(String(raw.tier ?? ''));
  return {
    tier,
    dailyMessageLimit: Number(raw.dailyMessageLimit ?? 0),
    maxMessageChars: Number(raw.maxMessageChars ?? 0),
    mirrorCooldownHours:
      raw.mirrorCooldownHours === null || raw.mirrorCooldownHours === undefined
        ? null
        : Number(raw.mirrorCooldownHours),
    dailyMirrorLimit:
      raw.dailyMirrorLimit === null || raw.dailyMirrorLimit === undefined
        ? null
        : Number(raw.dailyMirrorLimit),
    dailyDiscoverStartLimit: Number(raw.dailyDiscoverStartLimit ?? 0),
    relationshipMapAccess:
      raw.relationshipMapAccess === 'last_90_days' ||
      raw.relationshipMapAccess === 'all' ||
      raw.relationshipMapAccess === 'locked'
        ? raw.relationshipMapAccess
        : 'locked',
    imageQuality:
      raw.imageQuality === 'high' || raw.imageQuality === 'highest' || raw.imageQuality === 'medium'
        ? raw.imageQuality
        : 'medium',
    priorityGeneration: Boolean(raw.priorityGeneration),
  };
}

function normalizeUsage(raw: Record<string, unknown> | undefined): AccountUsageSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  return {
    dailyMessagesUsed: Number(raw.dailyMessagesUsed ?? 0),
    dailyMessagesLimit: Number(raw.dailyMessagesLimit ?? 0),
    dailyDiscoverStartsUsed: Number(raw.dailyDiscoverStartsUsed ?? 0),
    dailyDiscoverStartsLimit: Number(raw.dailyDiscoverStartsLimit ?? 0),
    visualCreationsUsed: Number(raw.visualCreationsUsed ?? 0),
    visualCreationsLimit:
      raw.visualCreationsLimit === null || raw.visualCreationsLimit === undefined
        ? null
        : Number(raw.visualCreationsLimit),
    nextVisualAvailableAt:
      typeof raw.nextVisualAvailableAt === 'string' ? raw.nextVisualAvailableAt : null,
  };
}

export async function fetchAccountEntitlements(): Promise<AccountEntitlementsResponse | null> {
  const token =
    typeof window !== 'undefined' ? window.localStorage.getItem('eza_token') : null;

  const headers: Record<string, string> = {};
  if (!token && typeof window !== 'undefined') {
    const guestToken = getOrCreateMirrorGuestToken();
    if (guestToken) {
      headers[GUEST_TOKEN_HEADER] = guestToken;
    }
  }

  const res = await apiClient.get<AccountEntitlementsResponse>('/api/account/entitlements', {
    auth: Boolean(token),
    headers,
  });

  if (!res.ok) return null;

  const payload = (res.data ?? res) as Record<string, unknown>;
  const entitlements = normalizeEntitlements(
    (payload.entitlements as Record<string, unknown> | undefined) ?? undefined
  );
  const usage = normalizeUsage((payload.usage as Record<string, unknown> | undefined) ?? undefined);
  if (!entitlements || !usage) return null;

  return {
    tier: normalizeTier(String(payload.tier ?? entitlements.tier)),
    label: typeof payload.label === 'string' ? payload.label : '',
    entitlements,
    usage,
  };
}
