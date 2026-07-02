/**
 * Conversation delete — block autosave resurrection and purge per-chat local state.
 * Does NOT delete Mirror Network / published Ayna data (server-side only).
 */

import { clearBranchSuggestionSession } from '@/lib/eza/conversation-tree/branchSuggestionSession';
import { clearMirrorBirthSession } from '@/lib/eza/mirror-birth/mirrorBirthSession';
import { clearConversationMirrorSnapshot } from '@/lib/eza/mirror/conversationMirrorSnapshot';
import { clearConversationMirrorSceneCache } from '@/lib/eza/mirror/mirrorSceneCache';
import { clearMirrorShareLink } from '@/lib/eza/mirror-share/mirrorShareLinkCache';

export const DELETED_CHAT_IDS_STORAGE_KEY = 'eza_deleted_chat_ids_v1';
export const DELETED_CHAT_TOMBSTONE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DeletedChatTombstone = {
  id: string;
  deletedAt: number;
};

function localStore(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage ?? null : null;
  } catch {
    return null;
  }
}

function readTombstones(now: number = Date.now()): DeletedChatTombstone[] {
  const store = localStore();
  if (!store) return [];
  try {
    const raw = store.getItem(DELETED_CHAT_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const valid: DeletedChatTombstone[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const deletedAt = typeof record.deletedAt === 'number' ? record.deletedAt : NaN;
      if (!id || !Number.isFinite(deletedAt)) continue;
      if (now - deletedAt > DELETED_CHAT_TOMBSTONE_TTL_MS) continue;
      valid.push({ id, deletedAt });
    }

    if (valid.length !== parsed.length) {
      writeTombstones(valid);
    }
    return valid;
  } catch {
    return [];
  }
}

function writeTombstones(records: DeletedChatTombstone[]): void {
  const store = localStore();
  if (!store) return;
  try {
    store.setItem(DELETED_CHAT_IDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore */
  }
}

export function markChatDeleted(id: string, now: number = Date.now()): void {
  const key = id.trim();
  if (!key) return;
  const records = readTombstones(now).filter((row) => row.id !== key);
  records.push({ id: key, deletedAt: now });
  writeTombstones(records);
}

export function isChatDeleted(id: string, now: number = Date.now()): boolean {
  const key = id.trim();
  if (!key) return false;
  return readTombstones(now).some((row) => row.id === key);
}

export function pruneExpiredDeletedChatTombstones(now: number = Date.now()): void {
  readTombstones(now);
}

/** Per-conversation client caches — safe to purge; network publish is untouched. */
export function purgeConversationLocalState(conversationId: string): void {
  const id = conversationId.trim();
  if (!id) return;
  clearMirrorBirthSession(id);
  clearBranchSuggestionSession(id);
  clearConversationMirrorSnapshot(id);
  clearConversationMirrorSceneCache(id);
  clearMirrorShareLink(id);
}
