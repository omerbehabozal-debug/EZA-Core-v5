/**
 * Phase 8.7 — Journey owner scope for auth and same-device guest drafts.
 *
 * Authenticated: production user id.
 * Guest: `guest:{token}` localStorage prefix (same device only).
 */

import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';

export function guestJourneyOwnerKey(guestToken: string): string {
  const token = guestToken.trim();
  return token ? `guest:${token}` : '';
}

export function isGuestJourneyOwnerKey(ownerKey: string | null | undefined): boolean {
  return Boolean(ownerKey?.trim().startsWith('guest:'));
}

/**
 * Resolve the storage owner key for Journey windows / Review / Ayna panel.
 * Guests may draft; publish remains auth-gated.
 */
export function resolveJourneyOwnerKey(
  userId: string | null | undefined,
  options?: { mintGuestToken?: boolean }
): string {
  const uid = (userId || '').trim();
  if (uid) return uid;
  if (typeof window === 'undefined') return '';
  if (options?.mintGuestToken === false) {
    return '';
  }
  const token = getOrCreateMirrorGuestToken();
  return guestJourneyOwnerKey(token);
}
