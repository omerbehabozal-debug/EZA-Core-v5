/**
 * Phase 6.0 / 6.2.2 — opaque experience session identity for Yansı ingest.
 *
 * Keyed by slug + pinned journeyVersion so refresh/resume reuses the same
 * experienceSessionId and eventIds. No frozen Q/A, EZA, tokens, IP, or UA.
 * Auth user id does not collapse or replace this unit.
 *
 * Replay-attempt lifecycle (Phase 6.2.2):
 * The same localStorage record is the SAME experience session across rerender,
 * in-flow navigation, page refresh, skip-return/resume, and completed revisit.
 * There is no TTL and no time-based mint.
 *
 * A genuinely NEW session is created only by:
 * - explicit future "Bu Yansı'yı yeniden deneyimle" / Replay Again
 *   (resetYansiExperienceSession — not called by current replay UI), or
 * - missing key after manual storage clear (unavoidable; no fingerprinting).
 *
 * A v1 and A v2 use different keys, so they are independent attempts.
 */

const SESSION_KEY_PREFIX = 'eza_yansi_experience_session_v1:';

export type YansiExperienceSessionRecord = {
  experienceSessionId: string;
  startedEventId: string;
  completedEventId: string;
  skipEventIds: Record<string, string>;
};

export function yansiExperienceSessionStorageKey(
  slug: string,
  journeyVersion: number
): string {
  return `${SESSION_KEY_PREFIX}${slug.trim().toLowerCase()}:v${journeyVersion}`;
}

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
}

function emptyRecord(): YansiExperienceSessionRecord {
  return {
    experienceSessionId: newUuid(),
    startedEventId: newUuid(),
    completedEventId: newUuid(),
    skipEventIds: {},
  };
}

function parseRecord(raw: string | null): YansiExperienceSessionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as YansiExperienceSessionRecord;
    if (
      !parsed?.experienceSessionId ||
      !parsed.startedEventId ||
      !parsed.completedEventId ||
      typeof parsed.skipEventIds !== 'object' ||
      parsed.skipEventIds == null
    ) {
      return null;
    }
    return {
      experienceSessionId: String(parsed.experienceSessionId),
      startedEventId: String(parsed.startedEventId),
      completedEventId: String(parsed.completedEventId),
      skipEventIds: { ...parsed.skipEventIds },
    };
  } catch {
    return null;
  }
}

function persist(key: string, record: YansiExperienceSessionRecord): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(record));
  } catch {
    /* ignore quota */
  }
}

export function getOrCreateYansiExperienceSession(
  slug: string,
  journeyVersion: number
): YansiExperienceSessionRecord {
  const key = yansiExperienceSessionStorageKey(slug, journeyVersion);
  const existing = parseRecord(storage()?.getItem(key) ?? null);
  if (existing) return existing;
  const created = emptyRecord();
  persist(key, created);
  return created;
}

/**
 * Mint a new experience session for an explicit future Replay Again action.
 *
 * Current product MUST NOT call this from landing, chain, refresh, resume,
 * skip-return, or completed revisit. Doing so would start a second STARTED
 * count. No TTL wrapper exists — time passing never calls this.
 */
export function resetYansiExperienceSession(
  slug: string,
  journeyVersion: number
): YansiExperienceSessionRecord {
  const key = yansiExperienceSessionStorageKey(slug, journeyVersion);
  const created = emptyRecord();
  persist(key, created);
  return created;
}

export function skipTransitionKey(
  completedStepCount: number,
  destinationSlug: string
): string {
  return `${completedStepCount}:${destinationSlug.trim().toLowerCase()}`;
}

export function allocateSkipEventId(
  slug: string,
  journeyVersion: number,
  completedStepCount: number,
  destinationSlug: string
): { experienceSessionId: string; eventId: string } {
  const key = yansiExperienceSessionStorageKey(slug, journeyVersion);
  const record = getOrCreateYansiExperienceSession(slug, journeyVersion);
  const trans = skipTransitionKey(completedStepCount, destinationSlug);
  const existing = record.skipEventIds[trans];
  if (existing) {
    return { experienceSessionId: record.experienceSessionId, eventId: existing };
  }
  const eventId = newUuid();
  record.skipEventIds[trans] = eventId;
  persist(key, record);
  return { experienceSessionId: record.experienceSessionId, eventId };
}

/** Test helper — does not clear frozen replay progress. */
export function clearYansiExperienceSessionsForTests(): void {
  const ls = storage();
  if (!ls) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i);
      if (k?.startsWith(SESSION_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
  } catch {
    /* ignore */
  }
}
