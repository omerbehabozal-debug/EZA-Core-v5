/**
 * 07F — shared /m/[slug] SSR resolver.
 *
 * Precedence: V1 mirror-network public payload wins when present.
 * On V1 404 only, fall through to sealed V2 public projection.
 * contentKind query is never sole proof of family; version pins do not float.
 */

import { fetchPublicMirrorBySlug } from '@/lib/eza/mirror-network/fetchPublicMirror';
import {
  formatMirrorLandingDate,
  pickMirrorLandingSurface,
} from '@/lib/eza/mirror-network/landingSurface';
import type { MirrorLandingSurface } from '@/lib/eza/mirror-network/publicTypes';
import { businessMediaUrl } from '@/lib/eza/mirror/journey/businessMedia';
import type { YansiV2PublicPublication } from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import { fetchYansiV2PublicPublicationResult } from '@/lib/eza/mirror/journey/fetchYansiV2PublicResult';
import {
  parsePinnedJourneyVersion,
  type YansiPublicContentKind,
} from '@/lib/eza/mirror-network/yansiPublicDepth';

export type ResolvePublicMirrorLandingResult =
  | {
      ok: true;
      source: 'v1' | 'v2';
      surface: MirrorLandingSurface;
      contentKind?: YansiPublicContentKind | null;
      publicationVersion?: number | null;
    }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'temporary'; status: number };

function surfaceFromV2Publication(
  publication: YansiV2PublicPublication
): MirrorLandingSurface {
  const slug = publication.slug.trim().toLowerCase();
  let cardTitle = slug;
  let curiosityContext = '';
  let sceneImageUrl: string | null = null;

  if (publication.contentKind === 'image' && 'media' in publication.public) {
    const media = publication.public.media;
    cardTitle = media.title?.trim() || slug;
    curiosityContext = cardTitle;
    sceneImageUrl = businessMediaUrl(media.contentPath);
  } else if (
    publication.contentKind !== 'image' &&
    'conversation' in publication.public
  ) {
    const { conversation, cover } = publication.public;
    curiosityContext = conversation.curiosityQuestion;
    cardTitle =
      publication.businessPublisher?.displayName?.trim() ||
      conversation.curiosityQuestion ||
      slug;
    if (cover?.contentPath) {
      sceneImageUrl = businessMediaUrl(cover.contentPath);
    }
  }

  return {
    slug,
    cardTitle,
    cardDate: '',
    dayLabel: formatMirrorLandingDate(''),
    sceneImageUrl,
    curiosityContext,
    publicSummary: curiosityContext,
  };
}

export async function resolvePublicMirrorLanding(input: {
  slug: string;
  searchParams?: URLSearchParams | string | null;
}): Promise<ResolvePublicMirrorLandingResult> {
  const slug = (input.slug || '').trim().toLowerCase();
  if (!slug) {
    return { ok: false, reason: 'not_found' };
  }

  const pinnedVersion = parsePinnedJourneyVersion(input.searchParams);

  const v1 = await fetchPublicMirrorBySlug(slug, { trustAuthoritative: true });
  if (v1.ok) {
    const surface = pickMirrorLandingSurface(v1.data);
    return {
      ok: true,
      source: 'v1',
      surface,
      publicationVersion: pinnedVersion,
    };
  }

  // Temporary upstream failure — do not pretend the Yansı is missing.
  if (v1.status !== 404) {
    return { ok: false, reason: 'temporary', status: v1.status || 502 };
  }

  // V1 miss → sealed V2 projection. Pinned journeyVersion maps to publication version;
  // never retry unpinned current after a pinned miss.
  const v2 = await fetchYansiV2PublicPublicationResult({
    slug,
    publicationVersion: pinnedVersion,
  });
  if (v2.ok) {
    // contentKind query is never sole proof — sealed V2 projection wins after V1 miss.
    return {
      ok: true,
      source: 'v2',
      surface: surfaceFromV2Publication(v2.data),
      contentKind: v2.data.contentKind,
      publicationVersion: v2.data.publicationVersion,
    };
  }

  if (v2.status !== 404) {
    return { ok: false, reason: 'temporary', status: v2.status || 502 };
  }

  return { ok: false, reason: 'not_found' };
}
