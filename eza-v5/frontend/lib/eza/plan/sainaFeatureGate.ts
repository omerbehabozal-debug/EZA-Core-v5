import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';

export type SainaGateOutcome = 'allow' | 'auth_required' | 'upgrade_required';

/** Mirror, İlişki Deseni ve benzeri premium katmanlar için gate. */
export function gatePremiumFeature(planTier: SainaPlanTier): SainaGateOutcome {
  if (planTier === 'premium' || planTier === 'standard') return 'allow';
  if (planTier === 'free' || planTier === 'mini') return 'upgrade_required';
  return 'auth_required';
}
