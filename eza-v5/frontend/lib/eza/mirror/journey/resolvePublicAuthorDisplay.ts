import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import { fetchAuthorPublishedYansilar } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { resolveAuthorDisplayName } from './aynaAuthorDisplay';

const cache = new Map<string, string>();

export async function resolvePublicAuthorDisplayName(
  authorUserId: string | null | undefined
): Promise<string> {
  const id = (authorUserId || '').trim();
  if (!id) return PUBLIC_DISPLAY_NAME_FALLBACK;
  const hit = cache.get(id);
  if (hit) return hit;

  const result = await fetchAuthorPublishedYansilar(id);
  if (result.ok && result.data.displayName.trim()) {
    cache.set(id, result.data.displayName.trim());
    return result.data.displayName.trim();
  }

  const fallback = resolveAuthorDisplayName({ userId: id });
  cache.set(id, fallback);
  return fallback;
}

export function clearPublicAuthorDisplayCacheForTests(): void {
  cache.clear();
}
