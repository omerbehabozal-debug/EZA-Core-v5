import { getOrCreateMirrorGuestToken } from '@/lib/eza/mirror-network/guestToken';
import { GUEST_TOKEN_HEADER } from '@/lib/eza/plan/guestTokenHeader';

/** Headers for SAINA quota-aware API calls (chat, entitlements). */
export function buildSainaQuotaHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const headers: Record<string, string> = {};
  const authToken = window.localStorage.getItem('eza_token');
  if (!authToken) {
    const guestToken = getOrCreateMirrorGuestToken();
    if (guestToken) {
      headers[GUEST_TOKEN_HEADER] = guestToken;
    }
  }
  return headers;
}

export function hasSainaAuthToken(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem('eza_token'));
}
