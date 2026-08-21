import { PUBLIC_DISPLAY_NAME_FALLBACK } from '@/lib/eza/mirror/publicIdentity';
import { fetchAuthorPublishedYansilar } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import {
  resolvePublicHonorificId,
  type PublicHonorificId,
} from '@/lib/eza/mirror/publicHonorific';
import { resolveAuthorDisplayName } from './aynaAuthorDisplay';

export type PublicAuthorIdentity = {
  displayName: string;
  publicHonorific: PublicHonorificId;
};

const cache = new Map<string, PublicAuthorIdentity>();

export async function resolvePublicAuthorIdentity(
  authorUserId: string | null | undefined
): Promise<PublicAuthorIdentity> {
  const id = (authorUserId || '').trim();
  if (!id) {
    return {
      displayName: PUBLIC_DISPLAY_NAME_FALLBACK,
      publicHonorific: 'curious',
    };
  }
  const hit = cache.get(id);
  if (hit) return hit;

  const result = await fetchAuthorPublishedYansilar(id);
  if (result.ok && result.data.displayName.trim()) {
    const identity: PublicAuthorIdentity = {
      displayName: result.data.displayName.trim(),
      publicHonorific: resolvePublicHonorificId(result.data.publicHonorific),
    };
    cache.set(id, identity);
    return identity;
  }

  const fallback: PublicAuthorIdentity = {
    displayName: resolveAuthorDisplayName({ userId: id }),
    publicHonorific: 'curious',
  };
  cache.set(id, fallback);
  return fallback;
}

export async function resolvePublicAuthorDisplayName(
  authorUserId: string | null | undefined
): Promise<string> {
  const identity = await resolvePublicAuthorIdentity(authorUserId);
  return identity.displayName;
}

export function clearPublicAuthorDisplayCacheForTests(): void {
  cache.clear();
}
