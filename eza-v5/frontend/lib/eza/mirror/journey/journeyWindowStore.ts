/**
 * Persist Journey conversation window state (user + conversation scoped).
 */

import {
  createEmptyJourneyConversationState,
  type JourneyConversationState,
} from './journeyWindows';

export const JOURNEY_WINDOW_STATE_STORAGE_KEY = 'eza_mirror_journey_windows_v1';

type Bucket = Record<string, Record<string, JourneyConversationState>>;

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
  return row;
}

export function saveJourneyConversationState(state: JourneyConversationState): void {
  const userId = (state.ownerUserId || '').trim();
  const convId = (state.sourceConversationId || '').trim();
  if (!userId || !convId) return;
  const bucket = readBucket();
  if (!bucket[userId]) bucket[userId] = {};
  bucket[userId]![convId] = state;
  writeBucket(bucket);
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
