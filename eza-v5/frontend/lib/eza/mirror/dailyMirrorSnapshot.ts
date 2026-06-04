/**
 * Client-side Daily Mirror snapshot — kart hangi veriyle üretildi (refresh sprint).
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';

export const DAILY_MIRROR_SNAPSHOT_STORAGE_KEY = 'eza_daily_mirror_snapshot';

export type DailyMirrorSnapshot = {
  dayKey: string;
  entryCount: number;
  latestEntryAt: string;
  generatedAt: string;
  cardDate: string;
};

export type MirrorRefreshCta = 'open_first' | 'current' | 'update';

export type EntrySignals = {
  entryCount: number;
  latestEntryAt: string | null;
};

function dayKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function normalizeSnapshot(parsed: unknown): DailyMirrorSnapshot | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (
    typeof raw.dayKey === 'string' &&
    typeof raw.entryCount === 'number' &&
    typeof raw.latestEntryAt === 'string' &&
    typeof raw.generatedAt === 'string' &&
    typeof raw.cardDate === 'string'
  ) {
    return {
      dayKey: raw.dayKey,
      entryCount: raw.entryCount,
      latestEntryAt: raw.latestEntryAt,
      generatedAt: raw.generatedAt,
      cardDate: raw.cardDate,
    };
  }
  return null;
}

export function computeEntrySignals(entries: SavedBehavioralEntry[]): EntrySignals {
  if (!entries.length) {
    return { entryCount: 0, latestEntryAt: null };
  }
  let latest = entries[0].savedAt;
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i].savedAt > latest) latest = entries[i].savedAt;
  }
  return { entryCount: entries.length, latestEntryAt: latest };
}

export function readDailyMirrorSnapshot(): DailyMirrorSnapshot | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(DAILY_MIRROR_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readTodaysSnapshot(now: Date = new Date()): DailyMirrorSnapshot | null {
  const snap = readDailyMirrorSnapshot();
  if (!snap) return null;
  return snap.dayKey === dayKeyFromDate(now) ? snap : null;
}

export function saveDailyMirrorSnapshot(
  entries: SavedBehavioralEntry[],
  cardDate: string,
  now: Date = new Date()
): DailyMirrorSnapshot {
  const signals = computeEntrySignals(entries);
  const record: DailyMirrorSnapshot = {
    dayKey: dayKeyFromDate(now),
    entryCount: signals.entryCount,
    latestEntryAt: signals.latestEntryAt ?? now.toISOString(),
    generatedAt: now.toISOString(),
    cardDate,
  };
  storage()?.setItem(DAILY_MIRROR_SNAPSHOT_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearDailyMirrorSnapshot(): void {
  storage()?.removeItem(DAILY_MIRROR_SNAPSHOT_STORAGE_KEY);
}

/** P4-D — drop snapshot from a previous calendar day (ephemeral daily mirror). */
export function clearStaleDailyMirrorSnapshot(now: Date = new Date()): boolean {
  const snap = readDailyMirrorSnapshot();
  if (!snap) return false;
  if (snap.dayKey === dayKeyFromDate(now)) return false;
  clearDailyMirrorSnapshot();
  return true;
}

export function hasNewDataSinceSnapshot(
  entries: SavedBehavioralEntry[],
  snapshot: DailyMirrorSnapshot | null,
  now: Date = new Date()
): boolean {
  if (!snapshot || snapshot.dayKey !== dayKeyFromDate(now)) return false;
  const signals = computeEntrySignals(entries);
  if (signals.entryCount > snapshot.entryCount) return true;
  if (
    signals.latestEntryAt &&
    signals.latestEntryAt > snapshot.latestEntryAt
  ) {
    return true;
  }
  return false;
}

/** Kart üretiminde kullanılacak girdi — yeni veri varsa snapshot anına kadar. */
export function entriesForDisplayedMirror(
  entries: SavedBehavioralEntry[],
  snapshot: DailyMirrorSnapshot | null,
  now: Date = new Date()
): SavedBehavioralEntry[] {
  if (!snapshot || snapshot.dayKey !== dayKeyFromDate(now)) return entries;
  if (!hasNewDataSinceSnapshot(entries, snapshot, now)) return entries;
  if (entries.length <= snapshot.entryCount) return entries;
  const sorted = [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  return sorted.slice(0, snapshot.entryCount);
}

export function resolveMirrorRefreshCta(
  entries: SavedBehavioralEntry[],
  now: Date = new Date()
): MirrorRefreshCta {
  const snap = readTodaysSnapshot(now);
  if (!snap) return 'open_first';
  if (hasNewDataSinceSnapshot(entries, snap, now)) return 'update';
  return 'current';
}
