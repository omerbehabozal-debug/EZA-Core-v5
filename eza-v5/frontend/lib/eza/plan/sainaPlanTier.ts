import type { PlanSource } from '@/lib/eza/plan/planStore';

export type SainaPlanTier = 'loading' | 'free' | 'premium' | 'unknown';

export function resolveSainaPlanTier(input: {
  isPlus: boolean;
  isLoading: boolean;
  source: PlanSource;
}): SainaPlanTier {
  if (input.isLoading) return 'loading';
  if (input.source === 'unknown') return 'unknown';
  if (input.source === 'server' || input.source === 'mock') {
    return input.isPlus ? 'premium' : 'free';
  }
  return 'free';
}
