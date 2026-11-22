/**
 * Stage 04C — Deneyimle hydrate: V1 frozen vs V2 public publication.
 *
 * Detection is not “/frozen 404 ⇒ V2”. Prefer explicit contentKind from Keşfet;
 * otherwise try V1 first (Discover V1-wins), then accept V2 only on a successful
 * public V2 projection.
 */

import { fetchV1PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/hydratePublishedJourneysFromServer';
import { fetchYansiV2PublicPublication } from '@/lib/eza/mirror/journey/fetchYansiV2Public';
import { mapV2PublicToFrozenArtifact } from '@/lib/eza/mirror/journey/mapV2PublicToFrozenArtifact';
import type { PublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';

export type PublicExperienceContentKindHint =
  | 'conversation'
  | 'image'
  | 'mixed'
  | null
  | undefined;

function isV2ContentKindHint(
  kind: PublicExperienceContentKindHint
): kind is 'conversation' | 'image' | 'mixed' {
  return kind === 'conversation' || kind === 'image' || kind === 'mixed';
}

async function loadV2Artifact(input: {
  slug: string;
  publicationVersion?: number | null;
  expectedKind?: PublicExperienceContentKindHint;
}): Promise<PublicFrozenJourneyArtifact | null> {
  const publication = await fetchYansiV2PublicPublication({
    slug: input.slug,
    publicationVersion: input.publicationVersion,
  });
  if (!publication) return null;
  if (
    isV2ContentKindHint(input.expectedKind) &&
    publication.contentKind !== input.expectedKind &&
    !(
      input.expectedKind === 'conversation' &&
      publication.contentKind === 'mixed'
    )
  ) {
    // Same slug must not open the wrong kind when Keşfet pinned a kind.
    return null;
  }
  return mapV2PublicToFrozenArtifact(publication);
}

/**
 * Load the public experience artifact for /m/{slug}.
 * `journeyVersion` is V1 journey version or V2 publication version (URL pin).
 */
export async function loadPublicExperienceArtifact(input: {
  slug: string;
  journeyVersion?: number | null;
  contentKind?: PublicExperienceContentKindHint;
}): Promise<PublicFrozenJourneyArtifact | null> {
  const slug = (input.slug || '').trim().toLowerCase();
  if (!slug) return null;
  const version =
    input.journeyVersion != null &&
    Number.isInteger(input.journeyVersion) &&
    input.journeyVersion >= 1
      ? input.journeyVersion
      : null;

  if (isV2ContentKindHint(input.contentKind)) {
    return loadV2Artifact({
      slug,
      publicationVersion: version,
      expectedKind: input.contentKind,
    });
  }

  const v1 = await fetchV1PublicFrozenJourneyArtifact({
    slug,
    journeyVersion: version,
  });
  if (v1) {
    return {
      ...v1,
      sourceKind: 'v1_frozen',
      liveContinuationAvailable: v1.liveContinuationAvailable !== false,
    };
  }

  // Fallback only after a failed V1 read: require a valid V2 public projection
  // (not merely the absence of /frozen).
  return loadV2Artifact({
    slug,
    publicationVersion: version,
  });
}
