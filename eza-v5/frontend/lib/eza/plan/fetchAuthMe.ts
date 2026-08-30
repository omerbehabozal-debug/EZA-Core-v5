/**
 * Sprint 2 — fetch authenticated user profile + Mirror entitlement.
 * Phase 8.3.1 — session validation for startup persistence.
 * Phase 8.5 — public_display_name on /me.
 */

/** Client timeout for auth / plan hydration (avoid infinite loading when API is down). */
export const AUTH_PLAN_REQUEST_TIMEOUT_MS = 15_000;

/** Login may wait longer on cold Railway / edge proxy before returning 5xx. */
export const AUTH_LOGIN_REQUEST_TIMEOUT_MS = 45_000;

import { apiClient } from '@/lib/apiClient';
import { getDirectApiBaseUrl, prefersDirectBackend } from '@/lib/apiUrl';
import {
  mergeAvatarAuthorityFields,
  normalizeAvatarRevision,
} from '@/lib/eza/profile/authoritativeAvatar';
import type { PlanId } from '@/lib/eza/plan/planStore';

export type AuthMeResponse = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan: PlanId;
  public_display_name?: string | null;
  public_avatar_url?: string | null;
  public_avatar_revision?: number;
  public_honorific?: string | null;
};

/** Lightweight session proof — does not require mirror_plan for validity. */
export type AuthSessionValidation = {
  user_id: string;
  email: string;
  role: string;
  mirror_plan?: PlanId;
  public_display_name?: string | null;
  public_avatar_url?: string | null;
  public_avatar_revision?: number;
  public_honorific?: string | null;
};

export type AuthSessionValidationResult =
  | { status: 'valid'; session: AuthSessionValidation }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type AuthUserProfileSeed = {
  email: string;
  role: string;
  user_id: string;
  full_name?: string;
  public_display_name?: string | null;
  public_avatar_url?: string | null;
  public_avatar_revision?: number;
  public_honorific?: string | null;
};

function authMeRequestOptions() {
  return {
    auth: true as const,
    timeoutMs: AUTH_PLAN_REQUEST_TIMEOUT_MS,
    directBackend: prefersDirectBackend(),
  };
}

/** Merge /api/auth/me session fields into a locally stored user record. */
export function mergeAuthSessionIntoUser(
  base: AuthUserProfileSeed,
  session: AuthSessionValidation
): AuthUserProfileSeed {
  const merged: AuthUserProfileSeed = {
    ...base,
    user_id: session.user_id,
    email: session.email || base.email,
    role: session.role || base.role,
    public_display_name:
      session.public_display_name !== undefined
        ? session.public_display_name
        : base.public_display_name,
    public_honorific:
      session.public_honorific !== undefined
        ? session.public_honorific
        : base.public_honorific,
  };
  return mergeAvatarAuthorityFields(merged, {
    public_avatar_url: session.public_avatar_url,
    public_avatar_revision: session.public_avatar_revision,
  });
}

/** After login/register — hydrate public name, avatar, and plan from server. */
export async function refreshAuthUserProfile(
  base: AuthUserProfileSeed
): Promise<AuthUserProfileSeed> {
  const result = await validateAuthSession();
  if (result.status === 'valid') {
    return mergeAuthSessionIntoUser(base, result.session);
  }
  return base;
}

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  const res = await apiClient.get<AuthMeResponse>('/api/auth/me', authMeRequestOptions());
  if (!res.ok) return null;
  const mirrorPlan = res.mirror_plan ?? res.data?.mirror_plan;
  if (!mirrorPlan) return null;
  const publicName =
    res.public_display_name ?? res.data?.public_display_name ?? null;
  const avatarRaw = res.public_avatar_url ?? res.data?.public_avatar_url ?? null;
  const revisionRaw = res.public_avatar_revision ?? res.data?.public_avatar_revision;
  const honorificRaw = res.public_honorific ?? res.data?.public_honorific ?? null;
  return {
    user_id: res.user_id ?? res.data?.user_id ?? '',
    email: res.email ?? res.data?.email ?? '',
    role: res.role ?? res.data?.role ?? '',
    mirror_plan: mirrorPlan === 'plus' ? 'plus' : 'free',
    public_display_name:
      typeof publicName === 'string' && publicName.trim() ? publicName.trim() : null,
    public_avatar_url:
      typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : null,
    public_avatar_revision: normalizeAvatarRevision(
      typeof revisionRaw === 'number' ? revisionRaw : Number(revisionRaw)
    ),
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

export function publicIdentitySaveErrorMessage(code?: string): string {
  if (code === 'display_name_looks_like_email') return 'E-posta adresi kullanılamaz.';
  if (code === 'display_name_too_short') return 'En az 2 karakter girin.';
  if (code === 'display_name_too_long') return 'En fazla 48 karakter.';
  if (code === 'display_name_reserved') return 'Bu ad kullanılamaz.';
  if (code === 'auth_required' || code === 'HTTP_401') {
    return 'Oturumunuz düştü. Tekrar giriş yapıp kaydedin.';
  }
  return 'Kaydedilemedi. Tekrar deneyin.';
}

export type PublicAvatarUpdateResult =
  | { ok: true; public_avatar_url: string; public_avatar_revision: number }
  | { ok: false; code?: string };

export type PublicAvatarDeleteResult =
  | { ok: true; public_avatar_revision: number }
  | { ok: false; code?: string };

function parseApiErrorCode(res: {
  detail?: unknown;
  error?: { error_code?: string; error?: string };
}): string {
  const detail =
    res.detail && typeof res.detail === 'object'
      ? (res.detail as { code?: string })
      : null;
  return String(res.error?.error_code || detail?.code || res.error?.error || '');
}

export async function uploadPublicAvatar(file: File): Promise<PublicAvatarUpdateResult> {
  const { getAuthToken } = await import('@/lib/eza/authTokenStore');
  const token = getAuthToken();
  if (!token) return { ok: false, code: 'auth_required' };

  const formData = new FormData();
  formData.append('file', file);

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AUTH_LOGIN_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${getDirectApiBaseUrl()}/api/auth/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail =
        data.detail && typeof data.detail === 'object'
          ? (data.detail as { code?: string })
          : null;
      const code = String(detail?.code || data.error?.error_code || data.error || `HTTP_${response.status}`);
      return { ok: false, code: code || undefined };
    }
    const url = String(data.public_avatar_url ?? data.data?.public_avatar_url ?? '').trim();
    const revision = normalizeAvatarRevision(
      data.public_avatar_revision ?? data.data?.public_avatar_revision
    );
    if (!url || revision <= 0) return { ok: false, code: 'avatar_update_failed' };
    return { ok: true, public_avatar_url: url, public_avatar_revision: revision };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, code: 'REQUEST_TIMEOUT' };
    }
    return { ok: false, code: 'NETWORK_ERROR' };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function deletePublicAvatar(): Promise<PublicAvatarDeleteResult> {
  const res = await apiClient.delete<{
    ok?: boolean;
    public_avatar_revision?: number;
  }>('/api/auth/me/avatar', {
    auth: true,
    directBackend: prefersDirectBackend(),
    timeoutMs: AUTH_PLAN_REQUEST_TIMEOUT_MS,
  });
  if (!res.ok) {
    return { ok: false, code: parseApiErrorCode(res) };
  }
  const revision = normalizeAvatarRevision(
    res.public_avatar_revision ?? res.data?.public_avatar_revision
  );
  if (revision <= 0) return { ok: false, code: 'avatar_clear_failed' };
  return { ok: true, public_avatar_revision: revision };
}

export function publicAvatarSaveErrorMessage(code?: string): string {
  if (code === 'avatar_too_large') return 'Dosya çok büyük. En fazla 2 MB yükleyebilirsiniz.';
  if (code === 'unsupported_avatar_format' || code === 'avatar_empty') {
    return 'Geçerli bir fotoğraf seçin (JPEG, PNG veya WebP).';
  }
  if (code === 'auth_required' || code === 'HTTP_401') {
    return 'Oturumunuz düştü. Tekrar giriş yapıp deneyin.';
  }
  if (code === 'REQUEST_TIMEOUT' || code === 'NETWORK_ERROR') {
    return 'Bağlantı zaman aşımına uğradı. Tekrar deneyin.';
  }
  return 'Fotoğraf yüklenemedi. Tekrar deneyin.';
}

/**
 * Validate persisted JWT against /api/auth/me.
 * - invalid: 401 / missing user (clear auth)
 * - unavailable: network/5xx (keep optimistic local session)
 * - valid: hydrate from server profile
 */
export async function validateAuthSession(): Promise<AuthSessionValidationResult> {
  const res = await apiClient.get<AuthMeResponse>('/api/auth/me', authMeRequestOptions());
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
  const avatarRaw = res.public_avatar_url ?? res.data?.public_avatar_url;
  const public_avatar_url =
    typeof avatarRaw === 'string' && avatarRaw.trim() ? avatarRaw.trim() : null;
  const revisionRaw = res.public_avatar_revision ?? res.data?.public_avatar_revision;
  const public_avatar_revision = normalizeAvatarRevision(
    typeof revisionRaw === 'number' ? revisionRaw : Number(revisionRaw)
  );
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
      public_avatar_url,
      public_avatar_revision,
      public_honorific,
    },
  };
}
