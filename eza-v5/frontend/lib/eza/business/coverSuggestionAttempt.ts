/** Collision-resistant attempt IDs for explicit cover-AI suggestion requests. */

const PREFIX = 'bilign-cover-ai-attempt:';

export function coverSuggestionAttemptStorageKey(
  businessId: string,
  assetId: string,
  revision: number,
): string {
  return `${PREFIX}${businessId}:${assetId}:r${revision}`;
}

export function createCoverSuggestionAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const stamp = Date.now().toString(36);
  const entropy = Math.random().toString(36).slice(2, 12);
  return `att-${stamp}-${entropy}`;
}

export function readCoverSuggestionAttemptId(
  businessId: string,
  assetId: string,
  revision: number,
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(
      coverSuggestionAttemptStorageKey(businessId, assetId, revision),
    );
    if (!raw || raw.length < 8 || raw.length > 120) return null;
    if (!/^[A-Za-z0-9._:-]+$/.test(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeCoverSuggestionAttemptId(
  businessId: string,
  assetId: string,
  revision: number,
  attemptId: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      coverSuggestionAttemptStorageKey(businessId, assetId, revision),
      attemptId,
    );
  } catch {
    // sessionStorage may be unavailable; in-memory state still carries the attempt.
  }
}

export function coverSuggestionIdempotencyKey(
  assetId: string,
  revision: number,
  attemptId: string,
): string {
  return `cover-video-${assetId}-r${revision}-a${attemptId}`;
}

const IMAGE_PREFIX = 'bilign-cover-ai-image-attempt:';

export function coverImageSuggestionAttemptStorageKey(
  businessId: string,
  draftId: string,
  revision: number,
): string {
  return `${IMAGE_PREFIX}${businessId}:${draftId}:r${revision}`;
}

export function coverImageSuggestionIdempotencyKey(
  draftId: string,
  revision: number,
  attemptId: string,
): string {
  return `cover-image-${draftId}-r${revision}-a${attemptId}`;
}

export function readCoverImageSuggestionAttemptId(
  businessId: string,
  draftId: string,
  revision: number,
): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(
      coverImageSuggestionAttemptStorageKey(businessId, draftId, revision),
    );
    if (!raw || raw.length < 8 || raw.length > 120) return null;
    if (!/^[A-Za-z0-9._:-]+$/.test(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeCoverImageSuggestionAttemptId(
  businessId: string,
  draftId: string,
  revision: number,
  attemptId: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      coverImageSuggestionAttemptStorageKey(businessId, draftId, revision),
      attemptId,
    );
  } catch {
    // sessionStorage may be unavailable; in-memory state still carries the attempt.
  }
}

export function resolveCoverImageSuggestionAttempt(
  businessId: string,
  draftId: string,
  revision: number,
  current: string | null,
): string {
  if (current) return current;
  const stored = readCoverImageSuggestionAttemptId(businessId, draftId, revision);
  if (stored) return stored;
  const created = createCoverSuggestionAttemptId();
  writeCoverImageSuggestionAttemptId(businessId, draftId, revision, created);
  return created;
}

export function beginNewCoverImageSuggestionAttempt(
  businessId: string,
  draftId: string,
  revision: number,
): string {
  const created = createCoverSuggestionAttemptId();
  writeCoverImageSuggestionAttemptId(businessId, draftId, revision, created);
  return created;
}

/** Resolve the attempt for a retry of the same user intent. Never invents on poll. */
export function resolveCoverSuggestionAttempt(
  businessId: string,
  assetId: string,
  revision: number,
  current: string | null,
): string {
  if (current) return current;
  const stored = readCoverSuggestionAttemptId(businessId, assetId, revision);
  if (stored) return stored;
  const created = createCoverSuggestionAttemptId();
  writeCoverSuggestionAttemptId(businessId, assetId, revision, created);
  return created;
}

/** Start a deliberate new paid attempt after explicit user confirmation. */
export function beginNewCoverSuggestionAttempt(
  businessId: string,
  assetId: string,
  revision: number,
): string {
  const created = createCoverSuggestionAttemptId();
  writeCoverSuggestionAttemptId(businessId, assetId, revision, created);
  return created;
}
