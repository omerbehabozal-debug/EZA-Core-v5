/**
 * Conversation delete — block autosave resurrection and purge per-chat local state.
 * Does NOT delete Mirror Network / published Ayna data (server-side only).
 */

import { clearBranchSuggestionSession } from '@/lib/eza/conversation-tree/branchSuggestionSession';
import { clearMirrorBirthSession } from '@/lib/eza/mirror-birth/mirrorBirthSession';
import { clearConversationMirrorSnapshot } from '@/lib/eza/mirror/conversationMirrorSnapshot';
import { clearConversationMirrorSceneCache } from '@/lib/eza/mirror/mirrorSceneCache';
import { clearMirrorShareLink } from '@/lib/eza/mirror-share/mirrorShareLinkCache';

const DELETED_CHAT_IDS_SESSION_KEY = 'eza_deleted_chat_ids_v1';

function session(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage ?? null : null;
  } catch {
    return null;
  }
}

function readDeletedChatIds(): Set<string> {
  const store = session();
  if (!store) return new Set();
  try {
    const raw = store.getItem(DELETED_CHAT_IDS_SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    );
  } catch {
    return new Set();
  }
}

function writeDeletedChatIds(ids: Set<string>): void {
  const store = session();
  if (!store) return;
  try {
    store.setItem(DELETED_CHAT_IDS_SESSION_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

export function markChatDeleted(id: string): void {
  const key = id.trim();
  if (!key) return;
  const ids = readDeletedChatIds();
  ids.add(key);
  writeDeletedChatIds(ids);
}

export function isChatDeleted(id: string): boolean {
  const key = id.trim();
  if (!key) return false;
  return readDeletedChatIds().has(key);
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
