'use client';

import { useSyncExternalStore } from 'react';
import {
  getPlanSnapshot,
  getPlanServerSnapshot,
  setPlan,
  subscribePlan,
  type PlanId,
} from '@/lib/eza/plan/planStore';

export interface UsePlanResult {
  plan: PlanId;
  isPlus: boolean;
  isFree: boolean;
  setPlan: (next: PlanId) => void;
}

/**
 * Mock plan hook (Sprint 1). Reads the localStorage-backed plan store via
 * useSyncExternalStore so every gate stays in sync without a provider.
 */
export function usePlan(): UsePlanResult {
  const plan = useSyncExternalStore(
    subscribePlan,
    getPlanSnapshot,
    getPlanServerSnapshot
  );

  return {
    plan,
    isPlus: plan === 'plus',
    isFree: plan === 'free',
    setPlan,
  };
}
