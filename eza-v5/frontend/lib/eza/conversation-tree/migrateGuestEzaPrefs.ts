/**
 * Phase 8.3 — migrate guest-scoped product prefs into authenticated user scope.
 * Additive only: never overwrite an existing user preference row.
 */

import {
  EZA_USER_PREFS_STORAGE_KEY,
  type EzaUserPreferences,
} from '@/lib/eza/ezaUserPrefs';

type PrefsStore = Record<string, EzaUserPreferences>;

function isPrefs(raw: unknown): raw is EzaUserPreferences {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  return (
    typeof row.ezaVisibilityEnabled === 'boolean' &&
    typeof row.ezaDataProcessingEnabled === 'boolean'
  );
}

export function migrateGuestEzaPrefsToUser(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  const owner = userId.trim();
  if (!owner) return false;

  try {
    const raw = localStorage.getItem(EZA_USER_PREFS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return false;
    const store = parsed as PrefsStore;
    const guest = store.guest;
    if (!isPrefs(guest)) return false;
    if (isPrefs(store[owner])) return false;
    store[owner] = { ...guest };
    localStorage.setItem(EZA_USER_PREFS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
