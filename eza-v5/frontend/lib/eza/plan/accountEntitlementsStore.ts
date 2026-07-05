/**
 * Client store for SAINA account entitlements (PR1 — read-only hydrate).
 */

import { fetchAccountEntitlements } from '@/lib/eza/plan/fetchAccountEntitlements';
import {
  buildStubUsage,
  getEntitlementsForTier,
  mapMirrorPlanToAccountTier,
  TIER_LABELS,
  type AccountEntitlementsResponse,
  type AccountTier,
} from '@/lib/eza/plan/tierEntitlements';
import { EZA_AUTH_CHANGED_EVENT, getPlanSnapshot, getPlanSourceSnapshot } from '@/lib/eza/plan/planStore';

const GUEST_DEFAULT: AccountEntitlementsResponse = {
  tier: 'guest',
  label: 'SAINA Guest',
  entitlements: getEntitlementsForTier('guest'),
  usage: buildStubUsage(getEntitlementsForTier('guest')),
};

let current: AccountEntitlementsResponse = GUEST_DEFAULT;
let isLoading = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setInternal(next: AccountEntitlementsResponse): void {
  current = next;
  emit();
}

function fallbackFromPlanStore(): AccountEntitlementsResponse {
  const plan = getPlanSnapshot();
  const source = getPlanSourceSnapshot();
  const isAuthenticated = source === 'server' || source === 'mock';
  const tier = mapMirrorPlanToAccountTier(plan, isAuthenticated);
  const entitlements = getEntitlementsForTier(tier);
  return {
    tier,
    label: TIER_LABELS[tier],
    entitlements,
    usage: buildStubUsage(entitlements),
  };
}

function ensureClientListeners(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;

  window.addEventListener(EZA_AUTH_CHANGED_EVENT, () => {
    void hydrateAccountEntitlementsFromServer();
  });
}

export function subscribeAccountEntitlements(listener: () => void): () => void {
  ensureClientListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAccountEntitlementsSnapshot(): AccountEntitlementsResponse {
  ensureClientListeners();
  return current;
}

export function getAccountTierSnapshot(): AccountTier {
  return getAccountEntitlementsSnapshot().tier;
}

export function getAccountEntitlementsLoadingSnapshot(): boolean {
  ensureClientListeners();
  return isLoading;
}

export function getAccountEntitlementsServerSnapshot(): AccountEntitlementsResponse {
  return GUEST_DEFAULT;
}

export async function hydrateAccountEntitlementsFromServer(): Promise<void> {
  if (typeof window === 'undefined') return;

  ensureClientListeners();
  isLoading = true;
  emit();

  try {
    const remote = await fetchAccountEntitlements();
    if (remote) {
      setInternal(remote);
    } else {
      setInternal(fallbackFromPlanStore());
    }
  } finally {
    isLoading = false;
    emit();
  }
}
