/**
 * Per-conversation Mirror snapshot — each chat thread keeps its own card state.
 */

import type { SavedBehavioralEntry } from '@/lib/behavioralHistory';
import {
  computeEntrySignals,
  type MirrorRefreshCta,
} from '@/lib/eza/mirror/dailyMirrorSnapshot';

export const CONVERSATION_MIRROR_SNAPSHOTS_STORAGE_KEY =
  'eza_conversation_mirror_snapshots_v1';

export type ConversationMirrorSnapshot = {
  conversationId: string;
  entryCount: number;
  latestEntryAt: string;
  generatedAt: string;
  cardDate: string;
};

type SnapshotStore = Record<string, ConversationMirrorSnapshot>;

function storage(): Storage | null {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function normalizeSnapshot(parsed: unknown): ConversationMirrorSnapshot | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  if (
    typeof raw.conversationId === 'string' &&
    typeof raw.entryCount === 'number' &&
    typeof raw.latestEntryAt === 'string' &&
    typeof raw.generatedAt === 'string' &&
    typeof raw.cardDate === 'string'
  ) {
    return {
      conversationId: raw.conversationId,
      entryCount: raw.entryCount,
      latestEntryAt: raw.latestEntryAt,
      generatedAt: raw.generatedAt,
      cardDate: raw.cardDate,
    };
  }
  return null;
}

function readStore(): SnapshotStore {
  const ls = storage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(CONVERSATION_MIRROR_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const store: SnapshotStore = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const snap = normalizeSnapshot(value);
      if (snap) store[key] = snap;
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: SnapshotStore): void {
  storage()?.setItem(CONVERSATION_MIRROR_SNAPSHOTS_STORAGE_KEY, JSON.stringify(store));
}

export function readConversationSnapshot(
  conversationId: string
): ConversationMirrorSnapshot | null {
  if (!conversationId.trim()) return null;
  return readStore()[conversationId] ?? null;
}

export function saveConversationMirrorSnapshot(
  conversationId: string,
  entries: SavedBehavioralEntry[],
  cardDate: string,
  now: Date = new Date()
): ConversationMirrorSnapshot {
  const signals = computeEntrySignals(entries);
  const record: ConversationMirrorSnapshot = {
    conversationId,
    entryCount: signals.entryCount,
    latestEntryAt: signals.latestEntryAt ?? now.toISOString(),
    generatedAt: now.toISOString(),
    cardDate,
  };
  const store = readStore();
  store[conversationId] = record;
  writeStore(store);
  return record;
}

export function clearConversationMirrorSnapshot(conversationId: string): void {
  const store = readStore();
  if (!store[conversationId]) return;
  delete store[conversationId];
  writeStore(store);
}

export function hasNewDataSinceConversationSnapshot(
  entries: SavedBehavioralEntry[],
  snapshot: ConversationMirrorSnapshot | null
): boolean {
  if (!snapshot) return false;
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

export function entriesForDisplayedConversationMirror(
  entries: SavedBehavioralEntry[],
  snapshot: ConversationMirrorSnapshot | null
): SavedBehavioralEntry[] {
  if (!snapshot) return entries;
  if (!hasNewDataSinceConversationSnapshot(entries, snapshot)) return entries;
  if (entries.length <= snapshot.entryCount) return entries;
  const sorted = [...entries].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  return sorted.slice(0, snapshot.entryCount);
}

export function resolveConversationMirrorRefreshCta(
  conversationId: string,
  entries: SavedBehavioralEntry[]
): MirrorRefreshCta {
  const snap = readConversationSnapshot(conversationId);
  if (!snap) return 'open_first';
  if (hasNewDataSinceConversationSnapshot(entries, snap)) return 'update';
  return 'current';
}
