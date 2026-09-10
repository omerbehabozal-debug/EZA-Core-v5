/**
 * Active conversation delete detection — React id, URL param, or persisted active id.
 * Render-owner leave: same-tab store/tombstone updates must clear the canvas.
 */

import { isChatDeleted } from '@/lib/standaloneChatDelete';
import { getChatArchive } from '@/lib/standaloneChatArchive';
import {
  hasCompleteServerAuthoritySnapshot,
  hasServerBackedConversation,
} from '@/lib/eza/serverConversationStore';

export function isConversationActiveForDelete(input: {
  targetId: string;
  chatId?: string | null;
  chatIdFromUrl?: string | null;
  activeChatId?: string | null;
}): boolean {
  const id = (input.targetId || '').trim();
  if (!id) return false;
  return (
    (input.chatId || '').trim() === id ||
    (input.chatIdFromUrl || '').trim() === id ||
    (input.activeChatId || '').trim() === id
  );
}

/**
 * True when the conversation currently rendered on the canvas is gone from
 * authoritative local/server stores (tombstone and/or hard removal).
 *
 * Authenticated/server-backed absence is UNKNOWN until
 * `hasCompleteServerAuthoritySnapshot()` — same readiness the sidebar uses.
 */
export function isRenderedConversationAuthoritativelyGone(input: {
  renderedChatId?: string | null;
  isServerBacked?: boolean;
}): boolean {
  const id = (input.renderedChatId || '').trim();
  if (!id) return false;
  if (isChatDeleted(id)) return true;
  const hasLocal = Boolean(getChatArchive(id));
  if (input.isServerBacked) {
    // Absence before a complete list snapshot is not authoritative (deep-link
    // hydrate / bootstrap race must not kick the canvas to new-chat).
    if (!hasCompleteServerAuthoritySnapshot()) return false;
    const hasServer = Boolean(hasServerBackedConversation(id));
    return !hasLocal && !hasServer;
  }
  return !hasLocal;
}
