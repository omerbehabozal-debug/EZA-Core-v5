/**
 * Phase 8.8G-2.2 — bind standalone chat UI/persistence to AuthContext owner.
 *
 * `undefined` = auth still hydrating (must not be treated as logout).
 * `null` = established guest / logged-out session.
 * `string` = authenticated production user_id.
 */

export type AuthOwnerKey = string | null | undefined;

export function resolveAuthOwnerKey(input: {
  isAuthReady: boolean;
  isAuthenticated: boolean;
  userId: string | null | undefined;
}): AuthOwnerKey {
  if (!input.isAuthReady) return undefined;
  if (!input.isAuthenticated || !input.userId) return null;
  return input.userId;
}

export function didAuthOwnerChange(previous: AuthOwnerKey, next: AuthOwnerKey): boolean {
  if (next === undefined) return false;
  if (previous === undefined) return false;
  return previous !== next;
}

/**
 * Invalidate account-scoped React chat UI only when leaving an authenticated owner
 * (logout A→guest or switch A→B). Guest→auth continuity must not clear local chat.
 */
export function shouldInvalidateAuthenticatedChatSession(
  previous: AuthOwnerKey,
  next: AuthOwnerKey
): boolean {
  if (next === undefined) return false;
  if (typeof previous !== 'string') return false;
  return previous !== next;
}

export function canPersistOwnerBoundAutosave(input: {
  skipAutosave: boolean;
  persistEpochAtSchedule: number;
  persistEpochNow: number;
  boundOwner: AuthOwnerKey;
  ownerNow: AuthOwnerKey;
}): boolean {
  if (input.skipAutosave) return false;
  if (input.persistEpochAtSchedule !== input.persistEpochNow) return false;
  if (input.boundOwner === undefined || input.ownerNow === undefined) return false;
  return input.boundOwner === input.ownerNow;
}

export function canApplySessionBoundResult(
  startedGeneration: number,
  currentGeneration: number
): boolean {
  return startedGeneration === currentGeneration;
}
