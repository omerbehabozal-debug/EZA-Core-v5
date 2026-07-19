import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import { getChatArchive } from '@/lib/standaloneChatArchive';

/**
 * Resolve cinematic background URL for Saina chrome.
 * When a chat is active, always prefer the archive so a stale React prop
 * cannot resurrect a previous Mirror after create/update cleared identity.
 */
export function resolveChromeConversationSceneUrl(
  activeChatId: string | null | undefined,
  conversationSceneUrl: string | null | undefined
): string | null {
  if (activeChatId) {
    const archiveUrl = getChatArchive(activeChatId)?.conversationSceneUrl;
    return archiveUrl && isPersistableConversationSceneUrl(archiveUrl)
      ? archiveUrl
      : null;
  }
  return conversationSceneUrl && isPersistableConversationSceneUrl(conversationSceneUrl)
    ? conversationSceneUrl
    : null;
}
