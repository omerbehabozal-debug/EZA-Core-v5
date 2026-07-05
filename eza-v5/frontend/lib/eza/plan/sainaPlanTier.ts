import type { PlanSource } from '@/lib/eza/plan/planStore';
import type { AccountTier } from '@/lib/eza/plan/tierEntitlements';

/** Sidebar plan card + premium feature gate tier. */
export type SainaPlanTier =
  | 'loading'
  | 'anonymous'
  | 'free'
  | 'mini'
  | 'standard'
  | 'premium'
  | 'session_invalid';

export function resolveSainaPlanTier(input: {
  isPlus: boolean;
  isLoading: boolean;
  source: PlanSource;
  accountTier?: AccountTier | null;
}): SainaPlanTier {
  if (input.isLoading) return 'loading';
  if (input.source === 'session_invalid') return 'session_invalid';
  if (input.accountTier && input.accountTier !== 'guest') {
    return input.accountTier;
  }
  if (input.source === 'server' || input.source === 'mock') {
    return input.isPlus ? 'premium' : 'free';
  }
  if (input.accountTier === 'guest') return 'anonymous';
  return 'anonymous';
}
