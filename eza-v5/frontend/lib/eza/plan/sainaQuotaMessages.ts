import type { AccountTier } from '@/lib/eza/plan/tierEntitlements';
import { formatVisualCooldownRemaining } from '@/lib/eza/plan/sainaVisualQuota';
import {
  SAINA_CHAT_LIMIT_REACHED,
  SAINA_DISCOVER_LIMIT_REACHED,
  SAINA_GUEST_CHAT_LIMIT_REACHED,
  SAINA_GUEST_DISCOVER_LIMIT_REACHED,
  SAINA_VISUAL_COOLDOWN_PREFIX,
  SAINA_VISUAL_LIMIT_REACHED,
  SAINA_VISUAL_NOT_ON_TIER,
} from '@/lib/eza/sainaCopy';

export type QuotaErrorDetail = {
  allowed?: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  currentTier?: string;
  recommendedTier?: string | null;
  nextVisualAvailableAt?: string | null;
};

export function isQuotaLimitReason(reason: string | undefined): boolean {
  if (!reason) return false;
  return (
    reason === 'daily_message_limit_reached' ||
    reason === 'guest_message_limit_reached' ||
    reason === 'message_too_long' ||
    reason === 'visual_not_available_on_tier' ||
    reason === 'visual_cooldown_active' ||
    reason === 'visual_daily_limit_reached' ||
    reason === 'daily_discover_limit_reached' ||
    reason === 'guest_discover_limit_reached'
  );
}

export function resolveVisualLimitMessage(detail: QuotaErrorDetail): string {
  if (detail.reason === 'visual_not_available_on_tier') {
    return SAINA_VISUAL_NOT_ON_TIER;
  }
  if (detail.reason === 'visual_cooldown_active' && detail.nextVisualAvailableAt) {
    const hours = formatVisualCooldownRemaining(detail.nextVisualAvailableAt);
    return `${SAINA_VISUAL_COOLDOWN_PREFIX} ${hours} kaldı.`;
  }
  return SAINA_VISUAL_LIMIT_REACHED;
}

export function resolveChatLimitMessage(tier: AccountTier | string): string {
  if (tier === 'guest' || tier === 'anonymous') {
    return SAINA_GUEST_CHAT_LIMIT_REACHED;
  }
  return SAINA_CHAT_LIMIT_REACHED;
}

export function resolveDiscoverLimitMessage(tier: AccountTier | string): string {
  if (tier === 'guest' || tier === 'anonymous') {
    return SAINA_GUEST_DISCOVER_LIMIT_REACHED;
  }
  return SAINA_DISCOVER_LIMIT_REACHED;
}

export function extractQuotaDetail(error: unknown): QuotaErrorDetail | null {
  if (!error || typeof error !== 'object') return null;
  const quotaDetail = (error as { quotaDetail?: QuotaErrorDetail }).quotaDetail;
  if (quotaDetail?.reason) return quotaDetail;
  return null;
}
