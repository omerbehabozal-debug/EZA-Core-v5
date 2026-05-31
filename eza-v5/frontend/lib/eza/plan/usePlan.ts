'use client';

import { useSyncExternalStore } from 'react';
import {
  getPlanLoadingSnapshot,
  getPlanServerSnapshot,
  getPlanSnapshot,
  getPlanSourceSnapshot,
  hydratePlanFromServer,
  setPlan,
  subscribePlan,
  type PlanId,
  type PlanSource,
} from '@/lib/eza/plan/planStore';

export interface UsePlanResult {
  plan: PlanId;
  isPlus: boolean;
  isFree: boolean;
  isLoading: boolean;
  source: PlanSource;
  setPlan: (next: PlanId) => void;
  refreshPlan: () => Promise<void>;
}

export function usePlan(): UsePlanResult {
  const plan = useSyncExternalStore(
    subscribePlan,
    getPlanSnapshot,
    getPlanServerSnapshot
  );
  const isLoading = useSyncExternalStore(
    subscribePlan,
    getPlanLoadingSnapshot,
    () => false
  );
  const source = useSyncExternalStore(
    subscribePlan,
    getPlanSourceSnapshot,
    () => 'default' as PlanSource
  );

  return {
    plan,
    isPlus: plan === 'plus',
    isFree: plan === 'free',
    isLoading,
    source,
    setPlan,
    refreshPlan: hydratePlanFromServer,
  };
}
