/**
 * Review 8 draft persistence — user + conversation + draftKey scoped.
 * RFC §13: client-only until prepare-meaning; Phase 2 PASS multi-journey ready.
 */

import {
  REVIEW8_DRAFT_STORAGE_KEY,
  type Review8Draft,
} from './types';
import { validateReview8Draft } from './review8Draft';

/** userId → conversationId → draftKey → draft */
type DraftBucket = Record<string, Record<string, Record<string, Review8Draft>>>;

type ActivePointerBucket = Record<string, Record<string, string>>;

const ACTIVE_POINTER_KEY = `${REVIEW8_DRAFT_STORAGE_KEY}__active`;

function readBucket(): DraftBucket {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REVIEW8_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftBucket;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeBucket(bucket: DraftBucket): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REVIEW8_DRAFT_STORAGE_KEY, JSON.stringify(bucket));
  } catch {
    /* quota */
  }
}

function readActive(): ActivePointerBucket {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACTIVE_POINTER_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ActivePointerBucket;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeActive(bucket: ActivePointerBucket): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_POINTER_KEY, JSON.stringify(bucket));
  } catch {
    /* quota */
  }
}

export function saveReview8Draft(draft: Review8Draft): void {
  const userId = (draft.ownerUserId || '').trim();
  const convId = (draft.sourceConversationId || '').trim();
  const draftKey = (draft.draftKey || '').trim();
  if (!userId || !convId || !draftKey) return;

  const bucket = readBucket();
  if (!bucket[userId]) bucket[userId] = {};
  if (!bucket[userId]![convId]) bucket[userId]![convId] = {};
  bucket[userId]![convId]![draftKey] = draft;
  writeBucket(bucket);

  const active = readActive();
  if (!active[userId]) active[userId] = {};
  active[userId]![convId] = draftKey;
  writeActive(active);
}

export function setActiveReview8DraftKey(
  ownerUserId: string,
  sourceConversationId: string,
  draftKey: string
): void {
  const userId = (ownerUserId || '').trim();
  const convId = (sourceConversationId || '').trim();
  const key = (draftKey || '').trim();
  if (!userId || !convId || !key) return;
  const active = readActive();
  if (!active[userId]) active[userId] = {};
  active[userId]![convId] = key;
  writeActive(active);
}

export function listReview8DraftsForConversation(
  ownerUserId: string,
  sourceConversationId: string
): Review8Draft[] {
  const userId = (ownerUserId || '').trim();
  const convId = (sourceConversationId || '').trim();
  if (!userId || !convId) return [];
  const rows = Object.values(readBucket()[userId]?.[convId] ?? {});
  return rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function loadReview8Draft(input: {
  ownerUserId: string;
  sourceConversationId: string;
  draftKey: string;
}): Review8Draft | null {
  const userId = (input.ownerUserId || '').trim();
  const convId = (input.sourceConversationId || '').trim();
  const draftKey = (input.draftKey || '').trim();
  if (!userId || !convId || !draftKey) return null;
  const draft = readBucket()[userId]?.[convId]?.[draftKey] ?? null;
  if (!draft) return null;
  const validated = validateReview8Draft(draft, {
    ownerUserId: userId,
    sourceConversationId: convId,
    draftKey,
    requireConfirmed: false,
  });
  if (!validated.ok) {
    clearReview8Draft({ ownerUserId: userId, sourceConversationId: convId, draftKey });
    return null;
  }
  return validated.draft;
}

/** Active draft for conversation (multi-journey aware). */
export function loadActiveReview8Draft(
  ownerUserId: string,
  sourceConversationId: string
): Review8Draft | null {
  const userId = (ownerUserId || '').trim();
  const convId = (sourceConversationId || '').trim();
  if (!userId || !convId) return null;
  const draftKey = readActive()[userId]?.[convId];
  if (draftKey) {
    const draft = loadReview8Draft({
      ownerUserId: userId,
      sourceConversationId: convId,
      draftKey,
    });
    if (draft) return draft;
  }
  const listed = listReview8DraftsForConversation(userId, convId);
  return listed[0] ?? null;
}

/** @deprecated Prefer loadActiveReview8Draft — conversation-only was unsafe. */
export function loadReview8DraftForConversation(
  sourceConversationId: string,
  ownerUserId?: string
): Review8Draft | null {
  if (!ownerUserId) return null;
  return loadActiveReview8Draft(ownerUserId, sourceConversationId);
}

export function clearReview8Draft(input: {
  ownerUserId: string;
  sourceConversationId: string;
  draftKey: string;
}): void {
  const userId = (input.ownerUserId || '').trim();
  const convId = (input.sourceConversationId || '').trim();
  const draftKey = (input.draftKey || '').trim();
  if (!userId || !convId || !draftKey) return;
  const bucket = readBucket();
  if (bucket[userId]?.[convId]?.[draftKey]) {
    delete bucket[userId]![convId]![draftKey];
    if (Object.keys(bucket[userId]![convId]!).length === 0) {
      delete bucket[userId]![convId];
    }
    if (Object.keys(bucket[userId]!).length === 0) {
      delete bucket[userId];
    }
    writeBucket(bucket);
  }
  const active = readActive();
  if (active[userId]?.[convId] === draftKey) {
    delete active[userId]![convId];
    writeActive(active);
  }
}

export function clearReview8DraftsForUser(ownerUserId: string): void {
  const userId = (ownerUserId || '').trim();
  if (!userId) return;
  const bucket = readBucket();
  if (bucket[userId]) {
    delete bucket[userId];
    writeBucket(bucket);
  }
  const active = readActive();
  if (active[userId]) {
    delete active[userId];
    writeActive(active);
  }
}

/** Wipe all Review 8 drafts (tests / logout). */
export function clearAllReview8Drafts(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REVIEW8_DRAFT_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_POINTER_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer clearAllReview8Drafts */
export function clearReview8DraftStore(): void {
  clearAllReview8Drafts();
}
