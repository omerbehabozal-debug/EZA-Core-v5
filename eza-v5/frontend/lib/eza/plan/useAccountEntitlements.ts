'use client';

import { useSyncExternalStore } from 'react';
import {
  getAccountEntitlementsLoadingSnapshot,
  getAccountEntitlementsServerSnapshot,
  getAccountEntitlementsSnapshot,
  hydrateAccountEntitlementsFromServer,
  subscribeAccountEntitlements,
} from '@/lib/eza/plan/accountEntitlementsStore';
import type { AccountEntitlementsResponse } from '@/lib/eza/plan/tierEntitlements';

export interface UseAccountEntitlementsResult {
  entitlements: AccountEntitlementsResponse;
  isLoading: boolean;
  refreshEntitlements: () => Promise<void>;
}

export function useAccountEntitlements(): UseAccountEntitlementsResult {
  const entitlements = useSyncExternalStore(
    subscribeAccountEntitlements,
    getAccountEntitlementsSnapshot,
    getAccountEntitlementsServerSnapshot
  );
  const isLoading = useSyncExternalStore(
    subscribeAccountEntitlements,
    getAccountEntitlementsLoadingSnapshot,
    () => false
  );

  return {
    entitlements,
    isLoading,
    refreshEntitlements: hydrateAccountEntitlementsFromServer,
  };
}
