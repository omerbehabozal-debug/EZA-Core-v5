/**
 * Guest token for mirror sohbet — no login required to continue exploring.
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
