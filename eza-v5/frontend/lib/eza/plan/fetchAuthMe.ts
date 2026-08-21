/**
 * Sprint 2 — fetch authenticated user profile + Mirror entitlement.
 * Phase 8.3.1 — session validation for startup persistence.
 * Phase 8.5 — public_display_name on /me.
 */

import { apiClient } from '@/lib/apiClient';
import type { PlanId } from '@/lib/eza/plan/planStore';

export type AuthMeResponse = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan: PlanId;
  public_display_name?: string | null;
  public_honorific?: string | null;
};

/** Lightweight session proof — does not require mirror_plan for validity. */
export type AuthSessionValidation = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan?: PlanId;
  public_display_name?: string | null;
  public_honorific?: string | null;
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
  const publicName =
    res.public_display_name ?? res.data?.public_display_name ?? null;
  const honorificRaw = res.public_honorific ?? res.data?.public_honorific ?? null;
  return {
    user_id: res.user_id ?? res.data?.user_id ?? '',
    email: res.email ?? res.data?.email ?? '',
    role: res.role ?? res.data?.role ?? '',
    mirror_plan: mirrorPlan === 'plus' ? 'plus' : 'free',
    public_display_name:
      typeof publicName === 'string' && publicName.trim() ? publicName.trim() : null,
    public_honorific:
      typeof honorificRaw === 'string' && honorificRaw.trim()
        ? honorificRaw.trim()
        : null,
  };
}

export type PublicIdentityUpdateResult =
  | {
      ok: true;
      public_display_name: string;
      resolved_public_display_name: string;
    }
  | { ok: false; code?: string };

export async function patchPublicIdentity(
  publicDisplayName: string
): Promise<PublicIdentityUpdateResult> {
  const res = await apiClient.patch<{
    public_display_name: string;
    resolved_public_display_name: string;
  }>('/api/auth/me/public-identity', {
    body: { public_display_name: publicDisplayName },
    auth: true,
  });
  if (!res.ok) {
    const detail =
      res.detail && typeof res.detail === 'object'
        ? (res.detail as { code?: string })
        : null;
    const code = String(
      res.error?.error_code || detail?.code || res.error?.error || ''
    );
    return { ok: false, code: code || undefined };
  }
  const name =
    res.public_display_name ?? res.data?.public_display_name ?? publicDisplayName;
  const resolved =
    res.resolved_public_display_name ??
    res.data?.resolved_public_display_name ??
    name;
  return {
    ok: true,
    public_display_name: String(name),
    resolved_public_display_name: String(resolved),
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
  const publicRaw = res.public_display_name ?? res.data?.public_display_name;
  const public_display_name =
    typeof publicRaw === 'string' && publicRaw.trim() ? publicRaw.trim() : null;
  const honorificRaw = res.public_honorific ?? res.data?.public_honorific;
  const public_honorific =
    typeof honorificRaw === 'string' && honorificRaw.trim()
      ? honorificRaw.trim()
      : null;
  return {
    status: 'valid',
    session: {
      user_id,
      email: String(res.email ?? res.data?.email ?? ''),
      role: String(res.role ?? res.data?.role ?? ''),
      ...(mirror_plan ? { mirror_plan } : {}),
      public_display_name,
      public_honorific,
    },
  };
}
