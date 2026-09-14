import { isConversationSceneDisplayUrl } from '@/lib/eza/conversationSceneIdentity';
import { getChatArchive } from '@/lib/standaloneChatArchive';

/**
 * Resolve cinematic background URL for Saina chrome.
 * When a chat is active, always prefer the archive so a stale React prop
 * cannot resurrect a previous Mirror after create/update cleared identity.
 *
 * This is the conversation-scoped scene only. Selected-Yansı display override
 * is applied separately via `resolveChromeDisplaySceneUrl`.
 */
export function resolveChromeConversationSceneUrl(
  activeChatId: string | null | undefined,
  conversationSceneUrl: string | null | undefined
): string | null {
  if (activeChatId) {
    const archiveUrl = getChatArchive(activeChatId)?.conversationSceneUrl;
    return archiveUrl && isConversationSceneDisplayUrl(archiveUrl)
      ? archiveUrl
      : null;
  }
  return conversationSceneUrl && isConversationSceneDisplayUrl(conversationSceneUrl)
    ? conversationSceneUrl
    : null;
}
