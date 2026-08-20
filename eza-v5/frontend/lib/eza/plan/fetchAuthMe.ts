/**
 * Sprint 2 — fetch authenticated user profile + Mirror entitlement.
 * Phase 8.3.1 — session validation for startup persistence.
 */

import { apiClient } from '@/lib/apiClient';
import type { PlanId } from '@/lib/eza/plan/planStore';

export type AuthMeResponse = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan: PlanId;
};

/** Lightweight session proof — does not require mirror_plan for validity. */
export type AuthSessionValidation = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan?: PlanId;
};

export type AuthSessionValidationResult =
  | { status: 'valid'; session: AuthSessionValidation }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  const res = await apiClient.get<AuthMeResponse>('/api/auth/me', { auth: true });
  if (!res.ok) return null;
  const mirrorPlan = res.mirror_plan ?? res.data?.mirror_plan;
  if (!mirrorPlan) return null;
  return {
    user_id: res.user_id ?? res.data?.user_id ?? '',
    email: res.email ?? res.data?.email ?? '',
    role: res.role ?? res.data?.role ?? '',
    mirror_plan: mirrorPlan === 'plus' ? 'plus' : 'free',
  };
}

/**
 * Validate persisted JWT against /api/auth/me.
 * - invalid: 401 / missing user (clear auth)
 * - unavailable: network/5xx (keep optimistic local session)
 * - valid: hydrate from server profile
 */
export async function validateAuthSession(): Promise<AuthSessionValidationResult> {
  const res = await apiClient.get<AuthMeResponse>('/api/auth/me', { auth: true });
  if (!res.ok) {
    const code = String(res.error?.error_code || res.error?.error || '');
    const isAuthFailure =
      code === 'auth_required' ||
      code === 'HTTP_401' ||
      code.includes('401') ||
      /unauthor/i.test(String(res.error?.error_message || res.error?.message || ''));
    if (isAuthFailure) return { status: 'invalid' };
    // Network / timeout / 5xx — do not force logout on reopen.
    return { status: 'unavailable' };
  }
  const user_id = String(res.user_id ?? res.data?.user_id ?? '').trim();
  if (!user_id) return { status: 'invalid' };
  const mirrorRaw = res.mirror_plan ?? res.data?.mirror_plan;
  const mirror_plan =
    mirrorRaw === 'plus' || mirrorRaw === 'free' ? (mirrorRaw as PlanId) : undefined;
  return {
    status: 'valid',
    session: {
      user_id,
      email: String(res.email ?? res.data?.email ?? ''),
      role: String(res.role ?? res.data?.role ?? ''),
      ...(mirror_plan ? { mirror_plan } : {}),
    },
  };
}
