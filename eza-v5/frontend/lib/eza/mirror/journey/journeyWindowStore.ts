/**
 * Persist Journey conversation window state (user + conversation scoped).
 * Multi-tab: compare-and-swap on stateVersion — stale writers do not overwrite.
 */

import {
  createEmptyJourneyConversationState,
  type JourneyConversationState,
} from './journeyWindows';

export const JOURNEY_WINDOW_STATE_STORAGE_KEY = 'eza_mirror_journey_windows_v1';

type Bucket = Record<string, Record<string, JourneyConversationState>>;

export type SaveJourneyStateResult =
  | { ok: true; state: JourneyConversationState }
  | {
      ok: false;
      code: 'stale_revision';
      current: JourneyConversationState;
    };

function readBucket(): Bucket {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(JOURNEY_WINDOW_STATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Bucket;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBucket(bucket: Bucket): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(JOURNEY_WINDOW_STATE_STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    /* quota */
  }
}

function normalizeLoaded(
  row: JourneyConversationState
): JourneyConversationState {
  return {
    ...row,
    acceptedEligibleQuestionCount:
      typeof row.acceptedEligibleQuestionCount === 'number'
        ? row.acceptedEligibleQuestionCount
        : row.eligiblePairCount ?? 0,
    stateVersion: typeof row.stateVersion === 'number' ? row.stateVersion : 0,
    journeyMode:
      row.journeyMode === 'private_chat_mode' ? 'private_chat_mode' : 'journey_mode',
  };
}

export function loadJourneyConversationState(
  ownerUserId: string,
  sourceConversationId: string
): JourneyConversationState | null {
  const userId = (ownerUserId || '').trim();
  const convId = (sourceConversationId || '').trim();
  if (!userId || !convId) return null;
  const row = readBucket()[userId]?.[convId] ?? null;
  if (!row) return null;
  if (row.ownerUserId !== userId || row.sourceConversationId !== convId) {
    return null;
  }
  return normalizeLoaded(row);
}

/**
 * CAS persist. `state.stateVersion` must match the currently stored revision
 * (or 0 when creating). On success, returns state with stateVersion + 1.
 */
export function saveJourneyConversationState(
  state: JourneyConversationState
): SaveJourneyStateResult {
  const userId = (state.ownerUserId || '').trim();
  const convId = (state.sourceConversationId || '').trim();
  if (!userId || !convId) {
    return {
      ok: false,
      code: 'stale_revision',
      current: state,
    };
  }

  const bucket = readBucket();
  const existing = bucket[userId]?.[convId]
    ? normalizeLoaded(bucket[userId]![convId]!)
    : null;
  const baseVersion = state.stateVersion ?? 0;
  const storedVersion = existing?.stateVersion ?? 0;

  if (existing && storedVersion !== baseVersion) {
    return { ok: false, code: 'stale_revision', current: existing };
  }

  const next: JourneyConversationState = {
    ...state,
    ownerUserId: userId,
    sourceConversationId: convId,
    stateVersion: baseVersion + 1,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };

  if (!bucket[userId]) bucket[userId] = {};
  bucket[userId]![convId] = next;
  writeBucket(bucket);
  return { ok: true, state: next };
}

export function clearJourneyConversationState(
  ownerUserId: string,
  sourceConversationId: string
): void {
  const userId = (ownerUserId || '').trim();
  const convId = (sourceConversationId || '').trim();
  if (!userId || !convId) return;
  const bucket = readBucket();
  if (!bucket[userId]?.[convId]) return;
  delete bucket[userId]![convId];
  if (Object.keys(bucket[userId]!).length === 0) delete bucket[userId];
  writeBucket(bucket);
}

export function clearAllJourneyConversationStates(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(JOURNEY_WINDOW_STATE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function ensureJourneyConversationState(input: {
  ownerUserId: string;
  sourceConversationId: string;
}): JourneyConversationState {
  return (
    loadJourneyConversationState(input.ownerUserId, input.sourceConversationId) ||
    createEmptyJourneyConversationState(input)
  );
}
