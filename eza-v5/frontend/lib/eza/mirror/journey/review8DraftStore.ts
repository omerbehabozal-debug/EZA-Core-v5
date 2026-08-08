/**
 * Review 8 draft persistence — localStorage (RFC §13: client-only until prepare-meaning).
 */

import {
  REVIEW8_DRAFT_STORAGE_KEY,
  type Review8Draft,
} from './types';

type DraftBucket = Record<string, Review8Draft>;

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

export function saveReview8Draft(draft: Review8Draft): void {
  const bucket = readBucket();
  bucket[draft.sourceConversationId] = draft;
  writeBucket(bucket);
}

export function loadReview8DraftForConversation(
  sourceConversationId: string
): Review8Draft | null {
  const id = (sourceConversationId || '').trim();
  if (!id) return null;
  return readBucket()[id] ?? null;
}

/** @deprecated Prefer loadReview8DraftForConversation — returns any single draft. */
export function loadReview8Draft(): Review8Draft | null {
  const bucket = readBucket();
  const values = Object.values(bucket);
  return values[0] ?? null;
}

export function clearReview8DraftForConversation(sourceConversationId: string): void {
  const id = (sourceConversationId || '').trim();
  if (!id) return;
  const bucket = readBucket();
  if (!(id in bucket)) return;
  delete bucket[id];
  writeBucket(bucket);
}

export function clearReview8Draft(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(REVIEW8_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
