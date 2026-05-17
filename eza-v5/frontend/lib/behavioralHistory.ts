/**
 * Local persistence for behavioral snapshots (demo / standalone only).
 * No PII — only numeric vectors returned by the pipeline.
 */

import type { BehavioralSnapshot } from '@/lib/types';

const STORAGE_KEY = 'eza_standalone_behavioral_history';
const MAX_ITEMS = 50;

/** Rapor sayfası ve diğer dinleyiciler için (aynı sekme). */
export const BEHAVIORAL_HISTORY_UPDATED = 'eza-behavioral-history-updated';

function notifyBehavioralHistoryUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(BEHAVIORAL_HISTORY_UPDATED));
}

export type SavedBehavioralEntry = BehavioralSnapshot & {
  savedAt: string;
};

export function appendBehavioralSnapshot(snapshot: BehavioralSnapshot | null | undefined): void {
  if (!snapshot || typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: SavedBehavioralEntry[] = raw ? JSON.parse(raw) : [];
    const entry: SavedBehavioralEntry = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    };
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
    notifyBehavioralHistoryUpdated();
  } catch {
    // ignore quota / parse errors
  }
}

export function isValidBehavioralEntry(
  entry: SavedBehavioralEntry | null | undefined
): entry is SavedBehavioralEntry {
  if (!entry?.vector) return false;
  const v = entry.vector;
  return (
    typeof v.input_risk === 'number' &&
    typeof v.output_risk === 'number' &&
    !Number.isNaN(v.input_risk) &&
    !Number.isNaN(v.output_risk)
  );
}

export function readBehavioralHistory(): SavedBehavioralEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBehavioralEntry);
  } catch {
    return [];
  }
}

export function clearBehavioralHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyBehavioralHistoryUpdated();
  } catch {
    /* empty */
  }
}
