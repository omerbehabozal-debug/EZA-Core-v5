/**
 * In-memory JWT mirror of localStorage `eza_token`.
 *
 * Plan hydrate used to wipe localStorage on /me 5xx while AuthContext still
 * held a live session. API calls that only read localStorage then looked
 * logged-out and failed with a generic save error.
 */

import { TOKEN_STORAGE_KEY } from '@/lib/eza/localIdentityScope';

let memoryToken: string | null = null;

export function setMemoryAuthToken(token: string | null): void {
  const next = typeof token === 'string' ? token.trim() : '';
  memoryToken = next || null;
}

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored && stored.trim() ? stored : null;
  } catch {
    return null;
  }
}
