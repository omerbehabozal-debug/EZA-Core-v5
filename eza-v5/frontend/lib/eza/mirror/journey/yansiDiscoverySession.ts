/**
 * In-experience vertical Discover session (Slice 3).
 *
 * ↓ = next Discover product (or forward history)
 * ↑ = previous visited product in THIS session
 *
 * Not graph lineage. Not /children.
 */

export type YansiDiscoverySession = {
  history: string[];
  activeIndex: number;
  /** Opaque Discover random-mode seed (stable for the session). */
  randomSession: string;
  /** Next Discover list offset to request when appending. */
  nextOffset: number;
  poolExhausted: boolean;
};

const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function normalizeDiscoverSlug(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/** Opaque seed compatible with backend parse_random_session. */
export function createDiscoverRandomSession(): string {
  const raw =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const seed = `ys${raw}`.slice(0, 64);
  return SESSION_RE.test(seed) ? seed : `ysession${Date.now()}`.slice(0, 64);
}

export function createYansiDiscoverySession(
  entrySlug: string,
  randomSession?: string
): YansiDiscoverySession | null {
  const slug = normalizeDiscoverSlug(entrySlug);
  if (!slug) return null;
  const seed = (randomSession || '').trim();
  return {
    history: [slug],
    activeIndex: 0,
    randomSession: SESSION_RE.test(seed) ? seed : createDiscoverRandomSession(),
    nextOffset: 0,
    poolExhausted: false,
  };
}

export function activeDiscoverSlug(session: YansiDiscoverySession): string {
  return session.history[session.activeIndex] || session.history[0] || '';
}

export function canDiscoverGoUp(session: YansiDiscoverySession): boolean {
  return session.activeIndex > 0;
}

/** True when DOWN should reuse forward history instead of fetching. */
export function canDiscoverGoDownInHistory(session: YansiDiscoverySession): boolean {
  return session.activeIndex < session.history.length - 1;
}

export function needsDiscoverFetchForDown(session: YansiDiscoverySession): boolean {
  return (
    session.activeIndex >= session.history.length - 1 && !session.poolExhausted
  );
}

export function discoverGoUp(
  session: YansiDiscoverySession
): YansiDiscoverySession | null {
  if (!canDiscoverGoUp(session)) return null;
  return { ...session, activeIndex: session.activeIndex - 1 };
}

export function discoverGoDownInHistory(
  session: YansiDiscoverySession
): YansiDiscoverySession | null {
  if (!canDiscoverGoDownInHistory(session)) return null;
  return { ...session, activeIndex: session.activeIndex + 1 };
}

export function discoverAppendAndActivate(
  session: YansiDiscoverySession,
  nextSlug: string
): YansiDiscoverySession | null {
  const slug = normalizeDiscoverSlug(nextSlug);
  if (!slug) return null;
  const excluded = new Set(session.history.map(normalizeDiscoverSlug));
  if (excluded.has(slug)) return null;
  // Only append when at the newest end.
  if (session.activeIndex !== session.history.length - 1) return null;
  return {
    ...session,
    history: [...session.history, slug],
    activeIndex: session.history.length,
  };
}

export function discoverMarkPoolExhausted(
  session: YansiDiscoverySession
): YansiDiscoverySession {
  return { ...session, poolExhausted: true };
}

export function discoverWithNextOffset(
  session: YansiDiscoverySession,
  nextOffset: number
): YansiDiscoverySession {
  return {
    ...session,
    nextOffset: Math.max(0, Math.floor(nextOffset)),
  };
}

export function discoverExcludeSet(session: YansiDiscoverySession): Set<string> {
  return new Set(session.history.map(normalizeDiscoverSlug).filter(Boolean));
}

/**
 * Slice 4 — horizontal continuation replaces the active Discover history entry
 * and truncates any stale forward vertical history (branch semantics).
 *
 * Example: [A, X, Y] active=X → replace with X2 → [A, X2]
 */
export function discoverReplaceActiveAndTruncate(
  session: YansiDiscoverySession,
  nextSlug: string
): YansiDiscoverySession | null {
  const slug = normalizeDiscoverSlug(nextSlug);
  if (!slug) return null;
  const idx = session.activeIndex;
  if (idx < 0 || idx >= session.history.length) return null;
  const kept = session.history.slice(0, idx);
  // Avoid duplicate consecutive entries if somehow same slug.
  if (kept[kept.length - 1] === slug) {
    return {
      ...session,
      history: [...kept],
      activeIndex: kept.length - 1,
      poolExhausted: false,
    };
  }
  return {
    ...session,
    history: [...kept, slug],
    activeIndex: kept.length,
    poolExhausted: false,
  };
}
