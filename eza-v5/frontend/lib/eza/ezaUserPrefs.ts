/**
 * Phase 4.3 — user-scoped EZA preference contract.
 *
 * Two independent controls:
 * - ezaVisibilityEnabled — presentation only (chat / future replay UI)
 * - ezaDataProcessingEnabled — private Relationship Map / profile writes
 *
 * Independent from Phase 4.2 frozen interaction ezaSnapshot (publish-time).
 * Never store these prefs on public Journey artifacts.
 */

export type EzaUserPreferences = {
  ezaVisibilityEnabled: boolean;
  ezaDataProcessingEnabled: boolean;
};

export const EZA_USER_PREFS_STORAGE_KEY = 'eza_user_eza_prefs_v1';

export const DEFAULT_EZA_USER_PREFERENCES: EzaUserPreferences = {
  ezaVisibilityEnabled: true,
  ezaDataProcessingEnabled: true,
};

type PrefsStore = Record<string, EzaUserPreferences>;

const prefsListeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function notify(): void {
  prefsListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeEzaUserPreferences(listener: () => void): () => void {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

/** User-scoped key; guests share a dedicated guest bucket (not cross-user). */
export function resolveEzaOwnerScope(ownerUserId?: string | null): string {
  const owner = (ownerUserId || '').trim();
  return owner || 'guest';
}

function isPrefs(raw: unknown): raw is EzaUserPreferences {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  return (
    typeof row.ezaVisibilityEnabled === 'boolean' &&
    typeof row.ezaDataProcessingEnabled === 'boolean'
  );
}

function readStore(): PrefsStore | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(EZA_USER_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: PrefsStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (isPrefs(value)) out[key] = { ...value };
    }
    return out;
  } catch {
    return null;
  }
}

function writeStore(store: PrefsStore): boolean {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(EZA_USER_PREFS_STORAGE_KEY, JSON.stringify(store));
    notify();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read preferences for a user. Missing key → product defaults (both ON).
 * Unreadable storage → fail-closed defaults for processing (OFF) and hide UI (OFF).
 */
export function getEzaUserPreferences(
  ownerUserId?: string | null
): EzaUserPreferences {
  const scope = resolveEzaOwnerScope(ownerUserId);
  const store = readStore();
  if (store === null) {
    return {
      ezaVisibilityEnabled: false,
      ezaDataProcessingEnabled: false,
    };
  }
  const row = store[scope];
  if (!row) return { ...DEFAULT_EZA_USER_PREFERENCES };
  return {
    ezaVisibilityEnabled: row.ezaVisibilityEnabled,
    ezaDataProcessingEnabled: row.ezaDataProcessingEnabled,
  };
}

export function setEzaUserPreferences(
  ownerUserId: string | null | undefined,
  patch: Partial<EzaUserPreferences>
): EzaUserPreferences {
  const scope = resolveEzaOwnerScope(ownerUserId);
  const store = readStore() ?? {};
  const current = store[scope] ?? { ...DEFAULT_EZA_USER_PREFERENCES };
  const next: EzaUserPreferences = {
    ezaVisibilityEnabled:
      typeof patch.ezaVisibilityEnabled === 'boolean'
        ? patch.ezaVisibilityEnabled
        : current.ezaVisibilityEnabled,
    ezaDataProcessingEnabled:
      typeof patch.ezaDataProcessingEnabled === 'boolean'
        ? patch.ezaDataProcessingEnabled
        : current.ezaDataProcessingEnabled,
  };
  store[scope] = next;
  writeStore(store);
  return { ...next };
}

/** Phase 5 / chat presentation — visibility only. */
export function shouldShowEzaInExperience(
  prefsOrOwner?: EzaUserPreferences | string | null
): boolean {
  if (prefsOrOwner && typeof prefsOrOwner === 'object') {
    return prefsOrOwner.ezaVisibilityEnabled === true;
  }
  return getEzaUserPreferences(prefsOrOwner).ezaVisibilityEnabled === true;
}

/** Private Relationship Map / profile processing — independent of visibility. */
export function shouldProcessExperienceForEzaProfile(
  prefsOrOwner?: EzaUserPreferences | string | null
): boolean {
  if (prefsOrOwner && typeof prefsOrOwner === 'object') {
    return prefsOrOwner.ezaDataProcessingEnabled === true;
  }
  return getEzaUserPreferences(prefsOrOwner).ezaDataProcessingEnabled === true;
}

/**
 * Fail-closed processing gate for write paths.
 * Returns false when storage unreadable or processing disabled.
 */
export function canWriteEzaProfileHistory(ownerUserId?: string | null): boolean {
  const store = readStore();
  if (store === null) return false;
  return shouldProcessExperienceForEzaProfile(ownerUserId);
}

/**
 * Phase 5 display contract — return stored frozen snapshot for UI when visibility
 * is ON. Never triggers scoring; never mutates the frozen artifact.
 */
export function resolveFrozenEzaSnapshotForDisplay<T>(
  frozenSnapshot: T | null | undefined,
  prefsOrOwner?: EzaUserPreferences | string | null
): T | null {
  if (!shouldShowEzaInExperience(prefsOrOwner)) return null;
  return frozenSnapshot ?? null;
}

/** Test helper — clear all scopes. */
export function clearEzaUserPreferencesForTests(): void {
  const ls = storage();
  try {
    ls?.removeItem(EZA_USER_PREFS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  notify();
}
