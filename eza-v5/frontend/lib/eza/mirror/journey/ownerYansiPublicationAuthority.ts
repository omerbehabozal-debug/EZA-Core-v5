/**
 * Phase 8.8F.2 — owner publication authority for sidebar green dots.
 *
 * Source: GET /api/mirror-network/me/profile-yansilar (visibility + safety).
 * Unpublished drafts stay local; this map is only for currently public/unlisted vs private/restricted.
 */

import { fetchOwnerProfileYansilar } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { demoteMirrorJourneyArtifactsByPublishedSlug } from './mirrorJourneyArtifactStore';

export type OwnerYansiPublicationRecord = {
  slug: string;
  visibility: string;
  safetyStatus: string;
};

export type OwnerYansiPublicationSnapshot = {
  ready: boolean;
  bySlug: Map<string, OwnerYansiPublicationRecord>;
};

const listeners = new Set<() => void>();

let snapshot: OwnerYansiPublicationSnapshot = {
  ready: false,
  bySlug: new Map(),
};

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

function setSnapshot(next: OwnerYansiPublicationSnapshot): void {
  snapshot = next;
  emit();
}

export function getOwnerYansiPublicationSnapshot(): OwnerYansiPublicationSnapshot {
  return {
    ready: snapshot.ready,
    bySlug: new Map(snapshot.bySlug),
  };
}

export function subscribeOwnerYansiPublicationAuthority(
  listener: () => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function noteOwnerYansiSlugPublication(
  slug: string,
  record: { visibility: string; safetyStatus?: string | null }
): void {
  const key = slug.trim().toLowerCase();
  if (!key) return;
  const bySlug = new Map(snapshot.bySlug);
  bySlug.set(key, {
    slug: key,
    visibility: (record.visibility || '').trim().toLowerCase() || 'private',
    safetyStatus: (record.safetyStatus || 'open').trim().toLowerCase() || 'open',
  });
  setSnapshot({ ready: true, bySlug });
}

export function markOwnerYansiPublicationAuthorityReadyEmpty(): void {
  setSnapshot({ ready: true, bySlug: new Map() });
}

export function applyOwnerYansiUnpublishedLocally(slug: string): void {
  noteOwnerYansiSlugPublication(slug, {
    visibility: 'private',
    safetyStatus: 'open',
  });
  demoteMirrorJourneyArtifactsByPublishedSlug(slug);
}

export function resetOwnerYansiPublicationAuthorityForTests(): void {
  snapshot = { ready: false, bySlug: new Map() };
}

export async function hydrateOwnerYansiPublicationAuthority(): Promise<void> {
  const result = await fetchOwnerProfileYansilar({ limit: 100, offset: 0 });
  if (!result.ok) {
    if (!snapshot.ready) {
      setSnapshot({ ready: true, bySlug: new Map() });
    }
    return;
  }
  const bySlug = new Map<string, OwnerYansiPublicationRecord>();
  for (const item of result.data.items) {
    const slug = item.slug.trim().toLowerCase();
    if (!slug) continue;
    bySlug.set(slug, {
      slug,
      visibility: (item.visibility || 'private').trim().toLowerCase(),
      safetyStatus: (item.safetyStatus || 'open').trim().toLowerCase(),
    });
  }
  setSnapshot({ ready: true, bySlug });
}
