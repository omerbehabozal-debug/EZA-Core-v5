/**
 * Canonical Discover modes — Phase 7.1.
 *
 * Product copy is biligN language. Internal identifiers stay existing names.
 * Missing/blank mode → Rastlantısal. Invalid mode is rejected, never remapped.
 */

export const DISCOVER_MODES = ['random', 'strong_curiosity', 'newest'] as const;

export type DiscoverMode = (typeof DISCOVER_MODES)[number];

export const DEFAULT_DISCOVER_MODE: DiscoverMode = 'random';

export const DISCOVER_MODE_LABELS: Record<DiscoverMode, string> = {
  random: 'Rastlantısal',
  strong_curiosity: 'Güçlü Merak',
  newest: 'En Yeni',
};

export const DISCOVER_MODE_PARAM = 'mode';

export const DISCOVER_RANDOM_SESSION_STORAGE_KEY = 'eza_discover_random_session_v1';

const RANDOM_SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type ParseDiscoverModeResult =
  | { ok: true; mode: DiscoverMode; missing: boolean }
  | { ok: false; reason: 'invalid_discover_mode'; raw: string };

export function parseDiscoverMode(raw: string | null | undefined): ParseDiscoverModeResult {
  if (raw == null) {
    return { ok: true, mode: DEFAULT_DISCOVER_MODE, missing: true };
  }
  const value = raw.trim().toLowerCase();
  if (!value) {
    return { ok: true, mode: DEFAULT_DISCOVER_MODE, missing: true };
  }
  if ((DISCOVER_MODES as readonly string[]).includes(value)) {
    return { ok: true, mode: value as DiscoverMode, missing: false };
  }
  return { ok: false, reason: 'invalid_discover_mode', raw };
}

export function parseDiscoverModeFromSearch(search: string): ParseDiscoverModeResult {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return parseDiscoverMode(params.get(DISCOVER_MODE_PARAM));
}

export function discoverHrefForMode(mode: DiscoverMode, pathname = '/standalone/discover'): string {
  if (mode === DEFAULT_DISCOVER_MODE) {
    return pathname;
  }
  return `${pathname}?${DISCOVER_MODE_PARAM}=${mode}`;
}

export function isDiscoverRandomSession(raw: string | null | undefined): boolean {
  return Boolean(raw && RANDOM_SESSION_RE.test(raw));
}

function sessionStorageSafe(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.sessionStorage ?? null : null;
  } catch {
    return null;
  }
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rs_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
}

/** Opaque permutation seed for Rastlantısal. Not a ranking signal or profile preference. */
export function getOrCreateDiscoverRandomSession(): string {
  const ss = sessionStorageSafe();
  const existing = ss?.getItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY);
  if (existing && isDiscoverRandomSession(existing)) return existing;
  const created = newSessionId();
  try {
    ss?.setItem(DISCOVER_RANDOM_SESSION_STORAGE_KEY, created);
  } catch {
    /* guests / blocked storage still work with ephemeral seed */
  }
  return created;
}

/** Rastlantısal may hide locally completed slugs as repetition reduction. Other modes must not. */
export function shouldHideExperiencedDiscoverItems(mode: DiscoverMode): boolean {
  return mode === 'random';
}

export function shouldApplyDiscoverResponse(requestId: number, currentId: number): boolean {
  return requestId === currentId;
}

/** Phase 8.7 — restore Discover scroll after /m/{slug} back navigation (same tab). */
export const DISCOVER_SCROLL_STORAGE_KEY = 'eza_discover_scroll_v1';

export function saveDiscoverScrollPosition(mode: DiscoverMode, scrollTop: number): void {
  const ss = sessionStorageSafe();
  if (!ss) return;
  try {
    ss.setItem(
      DISCOVER_SCROLL_STORAGE_KEY,
      JSON.stringify({ mode, scrollTop: Math.max(0, Math.round(scrollTop)) })
    );
  } catch {
    /* ignore */
  }
}

export function readDiscoverScrollPosition(mode: DiscoverMode): number | null {
  const ss = sessionStorageSafe();
  if (!ss) return null;
  try {
    const raw = ss.getItem(DISCOVER_SCROLL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mode?: string; scrollTop?: number };
    if (parsed.mode !== mode) return null;
    if (typeof parsed.scrollTop !== 'number' || !Number.isFinite(parsed.scrollTop)) {
      return null;
    }
    return Math.max(0, parsed.scrollTop);
  } catch {
    return null;
  }
}
