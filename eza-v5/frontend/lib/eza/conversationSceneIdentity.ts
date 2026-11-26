/**
 * Conversation visual identity — persistable scene URL rules (Phase 1).
 * Archive-only; separate from mirror runtime sceneImageUrl.
 */

export type ConversationSceneSource = 'mirror_local' | 'mirror_network' | 'mirror_guest';

/** Same-origin durable Yansı / mirror scene asset path (server-authoritative). */
export function isDurablePublicMirrorScenePath(url: string): boolean {
  return url.trim().startsWith('/api/public/mirror-scene-assets/');
}

/**
 * Same-origin Business Yansı public-media path (V2 cover / step image).
 * On *.ezacore.ai, `businessMediaUrl` resolves to this relative form — display-only.
 */
const PUBLIC_BUSINESS_MEDIA_PATH =
  /^\/api\/business-yansi\/public-media\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;

export function isDurablePublicBusinessMediaPath(url: string): boolean {
  return PUBLIC_BUSINESS_MEDIA_PATH.test(url.trim());
}

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

/**
 * Scene backdrop display — absolute persistable URLs or durable same-origin
 * public asset paths (mirror-scene + business-yansi public-media).
 * Not for archive persistence (relative public-media must not be archived).
 */
export function isConversationSceneDisplayUrl(url: string | null | undefined): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (isDurablePublicMirrorScenePath(trimmed)) return true;
  if (isDurablePublicBusinessMediaPath(trimmed)) return true;
  return isPersistableConversationSceneUrl(trimmed);
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
