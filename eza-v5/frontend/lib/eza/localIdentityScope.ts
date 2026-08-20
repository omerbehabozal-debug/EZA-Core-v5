/**
 * Phase 8.3.1 — local identity scope for same-device conversation state.
 *
 * Namespaces:
 * - user:{userId}  — authenticated account (stable internal id, never email)
 * - guest:{guestToken} — anonymous device guest
 *
 * Browser close is not logout. Explicit logout switches visibility to a fresh
 * guest scope; account-scoped buckets remain on device until that user returns.
 */

import { peekMirrorGuestToken, getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';

export const TOKEN_STORAGE_KEY = 'eza_token';
export const USER_STORAGE_KEY = 'eza_user';

/** Minimal marker so failed claim can retry without empty-claim churn. */
export const PENDING_GUEST_CLAIM_KEY = 'eza_pending_guest_claim_v1';

export type LocalIdentityScope =
  | { kind: 'user'; userId: string }
  | { kind: 'guest'; guestToken: string };

export type PendingGuestClaim = {
  guestToken: string;
  userId: string;
};

export function scopeKey(scope: LocalIdentityScope): string {
  if (scope.kind === 'user') return `user:${scope.userId}`;
  return `guest:${scope.guestToken}`;
}

export function userScope(userId: string): LocalIdentityScope {
  return { kind: 'user', userId: userId.trim() };
}

export function guestScope(guestToken: string): LocalIdentityScope {
  return { kind: 'guest', guestToken: guestToken.trim() };
}

export function readPersistedAuthUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const userStr = localStorage.getItem(USER_STORAGE_KEY);
    if (!token || !userStr) return null;
    const user = JSON.parse(userStr) as { user_id?: unknown };
    const id = typeof user?.user_id === 'string' ? user.user_id.trim() : '';
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the identity that currently owns visible local conversation state.
 * Mint a guest token only when no auth identity exists.
 */
export function resolveCurrentLocalIdentityScope(options?: {
  /** When true (default), mint guest token if missing. */
  createGuestIfMissing?: boolean;
}): LocalIdentityScope | null {
  if (typeof window === 'undefined') return null;
  const userId = readPersistedAuthUserId();
  if (userId) return userScope(userId);

  const create = options?.createGuestIfMissing !== false;
  const guestToken = create ? getOrCreateMirrorGuestToken() : peekMirrorGuestToken();
  if (!guestToken) return null;
  return guestScope(guestToken);
}

export function readPendingGuestClaim(): PendingGuestClaim | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_GUEST_CLAIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingGuestClaim;
    const guestToken = typeof parsed?.guestToken === 'string' ? parsed.guestToken.trim() : '';
    const userId = typeof parsed?.userId === 'string' ? parsed.userId.trim() : '';
    if (!guestToken || !userId) return null;
    return { guestToken, userId };
  } catch {
    return null;
  }
}

export function writePendingGuestClaim(claim: PendingGuestClaim): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      PENDING_GUEST_CLAIM_KEY,
      JSON.stringify({
        guestToken: claim.guestToken.trim(),
        userId: claim.userId.trim(),
      })
    );
  } catch {
    /* quota */
  }
}

export function clearPendingGuestClaim(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_GUEST_CLAIM_KEY);
  } catch {
    /* ignore */
  }
}

/** Client-side JWT exp check — opaque/non-JWT tokens defer to server validation. */
export function isJwtExpired(token: string, skewSeconds = 30): boolean | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000 <= Date.now() - skewSeconds * 1000;
  } catch {
    return null;
  }
}
