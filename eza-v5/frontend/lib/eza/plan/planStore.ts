/**
 * EZA Sprint 1 — Mock plan store (UX/plan layer only).
 *
 * Gerçek auth/ödeme gelene kadar plan durumu localStorage'ta tutulur.
 * Backend, behavioral history veya mirror üretim mantığıyla hiçbir ilişkisi yoktur.
 */

export type PlanId = 'free' | 'plus';

export const EZA_PLAN_STORAGE_KEY = 'eza_plan';

const DEFAULT_PLAN: PlanId = 'free';

let current: PlanId = DEFAULT_PLAN;
let hydrated = false;
const listeners = new Set<() => void>();

function normalize(raw: string | null): PlanId {
  return raw === 'plus' ? 'plus' : 'free';
}

function readStorage(): PlanId {
  if (typeof window === 'undefined') return DEFAULT_PLAN;
  try {
    return normalize(window.localStorage.getItem(EZA_PLAN_STORAGE_KEY));
  } catch {
    return DEFAULT_PLAN;
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Lazily read localStorage on the client and wire cross-tab sync. */
function ensureHydrated(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  current = readStorage();
  window.addEventListener('storage', (event) => {
    if (event.key !== EZA_PLAN_STORAGE_KEY) return;
    const next = normalize(event.newValue);
    if (next !== current) {
      current = next;
      emit();
    }
  });
}

export function subscribePlan(listener: () => void): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlanSnapshot(): PlanId {
  ensureHydrated();
  return current;
}

/** SSR + ilk hidrasyon render'ı için sabit değer (hydration mismatch'i önler). */
export function getPlanServerSnapshot(): PlanId {
  return DEFAULT_PLAN;
}

export function setPlan(next: PlanId): void {
  if (next === current) return;
  current = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(EZA_PLAN_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — keep in-memory value */
    }
  }
  emit();
}
