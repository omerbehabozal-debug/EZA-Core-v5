/**
 * EZA Plan store — Sprint 2 server entitlement + dev mock override.
 */

import { fetchAuthMe } from '@/lib/eza/plan/fetchAuthMe';

export type PlanId = 'free' | 'plus';

export type PlanSource = 'server' | 'mock' | 'default' | 'unknown';

export const EZA_PLAN_STORAGE_KEY = 'eza_plan';
export const EZA_AUTH_CHANGED_EVENT = 'eza-auth-changed';

const DEFAULT_PLAN: PlanId = 'free';

let current: PlanId = DEFAULT_PLAN;
let planSource: PlanSource = 'default';
let isLoading = false;
let hydrated = false;
const listeners = new Set<() => void>();

function normalize(raw: string | null | undefined): PlanId {
  return raw === 'plus' ? 'plus' : 'free';
}

function readDevMockOverride(): PlanId | null {
  if (typeof window === 'undefined') return null;
  if (process.env.NODE_ENV === 'production') return null;
  try {
    const raw = window.localStorage.getItem(EZA_PLAN_STORAGE_KEY);
    if (raw === null) return null;
    return normalize(raw);
  } catch {
    return null;
  }
}

function applyDevMockOverride(): void {
  const mock = readDevMockOverride();
  if (mock !== null) {
    current = mock;
    planSource = 'mock';
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setInternal(plan: PlanId, source: PlanSource): void {
  current = plan;
  planSource = source;
  emit();
}

/** Lazily wire cross-tab sync + auth-changed refresh. */
function ensureClientListeners(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== EZA_PLAN_STORAGE_KEY) return;
    if (process.env.NODE_ENV === 'production') return;
    applyDevMockOverride();
    emit();
  });

  window.addEventListener(EZA_AUTH_CHANGED_EVENT, () => {
    void hydratePlanFromServer();
  });
}

export function subscribePlan(listener: () => void): () => void {
  ensureClientListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlanSnapshot(): PlanId {
  ensureClientListeners();
  return current;
}

export function getPlanSourceSnapshot(): PlanSource {
  ensureClientListeners();
  return planSource;
}

export function getPlanLoadingSnapshot(): boolean {
  ensureClientListeners();
  return isLoading;
}

export function getPlanServerSnapshot(): PlanId {
  return DEFAULT_PLAN;
}

/** Production: /api/auth/me. Dev: server then localStorage mock override. */
export async function hydratePlanFromServer(): Promise<void> {
  if (typeof window === 'undefined') return;

  ensureClientListeners();
  isLoading = true;
  emit();

  try {
    const token = window.localStorage.getItem('eza_token');
    if (!token) {
      setInternal(DEFAULT_PLAN, 'default');
    } else {
      const me = await fetchAuthMe();
      if (me) {
        setInternal(normalize(me.mirror_plan), 'server');
      } else {
        setInternal(DEFAULT_PLAN, 'unknown');
      }
    }
    applyDevMockOverride();
  } finally {
    isLoading = false;
    emit();
  }
}

/** Dev-only manual override (SettingsModal). Production no-op. */
export function setPlan(next: PlanId): void {
  if (process.env.NODE_ENV === 'production') return;
  current = next;
  planSource = 'mock';
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(EZA_PLAN_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function notifyAuthChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EZA_AUTH_CHANGED_EVENT));
}
