/**
 * Guest token for mirror sohbet — no login required to continue exploring.
 *
 * Phase 8.3 lifecycle:
 * - Unauthenticated activity uses a device guest token.
 * - After successful claim into an account, the token is rotated so a later
 *   account on the same browser cannot re-claim the prior guest identity.
 * - Logout also rotates so post-logout guest work starts a fresh identity.
 */

import { MIRROR_GUEST_TOKEN_KEY } from '@/lib/eza/mirror-network/sohbetTypes';

function randomToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateMirrorGuestToken(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(MIRROR_GUEST_TOKEN_KEY);
  if (existing && existing.length >= 16) return existing;
  const token = randomToken();
  localStorage.setItem(MIRROR_GUEST_TOKEN_KEY, token);
  return token;
}

/** Peek without minting — used before auth to capture claim identity. */
export function peekMirrorGuestToken(): string | null {
  if (typeof window === 'undefined') return null;
  const existing = localStorage.getItem(MIRROR_GUEST_TOKEN_KEY);
  if (existing && existing.length >= 16) return existing;
  return null;
}

/**
 * Rotate guest identity after claim or logout.
 * Prevents shared-browser account A → logout → account B from reclaiming A's guest groups.
 */
export function rotateMirrorGuestToken(): string {
  if (typeof window === 'undefined') return '';
  const token = randomToken();
  localStorage.setItem(MIRROR_GUEST_TOKEN_KEY, token);
  return token;
}

export function clearMirrorGuestToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MIRROR_GUEST_TOKEN_KEY);
}
