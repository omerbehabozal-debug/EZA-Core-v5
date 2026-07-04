/**
 * Conversation visual identity — persistable scene URL rules (Phase 1).
 * Archive-only; separate from mirror runtime sceneImageUrl.
 */

export type ConversationSceneSource = 'mirror_local' | 'mirror_network' | 'mirror_guest';

/** HTTP(S) only — rejects data:, blob:, and non-URL strings. Production requires HTTPS. */
export function isPersistableConversationSceneUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function normalizeConversationSceneSlug(slug?: string | null): string | null {
  const trimmed = (slug || '').trim().toLowerCase();
  return trimmed || null;
}

export type ConversationSceneIdentityInput = {
  url?: string | null;
  source: ConversationSceneSource;
  slug?: string | null;
};

export type ConversationSceneIdentityFields = {
  conversationSceneUrl: string;
  conversationSceneSource: ConversationSceneSource;
  conversationSceneSlug: string | null;
};

/** Returns fields to merge onto ArchivedChat when URL is persistable. */
export function buildConversationSceneIdentityFields(
  input: ConversationSceneIdentityInput
): ConversationSceneIdentityFields | null {
  const url = (input.url || '').trim();
  if (!isPersistableConversationSceneUrl(url)) return null;
  return {
    conversationSceneUrl: url,
    conversationSceneSource: input.source,
    conversationSceneSlug: normalizeConversationSceneSlug(input.slug),
  };
}
