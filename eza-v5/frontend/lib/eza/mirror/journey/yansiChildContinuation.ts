/**
 * Phase 5.1 — published child Yansı continuation helpers.
 * Children list is public metadata; replay eligibility requires /frozen parse.
 */

import { fetchPublishedChildren } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import type { AuthorPublishedYansiItem } from '@/lib/eza/mirror-network/fetchAuthorPublished';
import { fetchPublicFrozenJourneyArtifact } from './hydratePublishedJourneysFromServer';
import type { PublicFrozenJourneyArtifact } from './publicFrozenTypes';

export type EligibleChildContinuation = {
  meta: AuthorPublishedYansiItem;
  artifact: PublicFrozenJourneyArtifact;
};

export type ChildContinuationPlan = {
  parentSlug: string;
  primary: EligibleChildContinuation | null;
  alternatives: EligibleChildContinuation[];
  /** Direct published children that were not replay-ready (skipped). */
  skippedCount: number;
};

/**
 * Deterministic primary = first eligible by server order (publishedAt desc).
 * Alternatives = remaining eligible siblings.
 * Lazy: only freezes next N candidates until primary found + a few alts.
 */
export async function loadChildContinuationPlan(
  parentSlug: string,
  options?: { maxProbe?: number; maxAlternatives?: number }
): Promise<ChildContinuationPlan> {
  const slug = parentSlug.trim().toLowerCase();
  const maxProbe = options?.maxProbe ?? 8;
  const maxAlternatives = options?.maxAlternatives ?? 6;

  const empty: ChildContinuationPlan = {
    parentSlug: slug,
    primary: null,
    alternatives: [],
    skippedCount: 0,
  };
  if (!slug) return empty;

  const listed = await fetchPublishedChildren(slug);
  if (!listed.ok) return empty;

  const candidates = listed.data.items.slice(0, maxProbe);
  const eligible: EligibleChildContinuation[] = [];
  let skipped = 0;

  for (const meta of candidates) {
    const artifact = await fetchPublicFrozenJourneyArtifact({ slug: meta.slug });
    if (!artifact) {
      skipped += 1;
      continue;
    }
    // Prefer stored scene/title from frozen; fall back to list meta only if missing.
    eligible.push({
      meta: {
        ...meta,
        publicTitle: artifact.publicTitle || meta.publicTitle,
        publicSummary: artifact.publicSummary ?? meta.publicSummary,
        sceneImageUrl: artifact.sceneImageUrl ?? meta.sceneImageUrl,
        parentSlug: artifact.parentSlug ?? meta.parentSlug ?? slug,
      },
      artifact,
    });
    if (eligible.length >= 1 + maxAlternatives) break;
  }

  const [primary, ...alternatives] = eligible;
  return {
    parentSlug: slug,
    primary: primary ?? null,
    alternatives,
    skippedCount: skipped,
  };
}

/** Pure helper for tests — pick primary + alts from already-eligible list. */
export function selectPrimaryAndAlternatives(
  eligible: EligibleChildContinuation[]
): { primary: EligibleChildContinuation | null; alternatives: EligibleChildContinuation[] } {
  if (!eligible.length) return { primary: null, alternatives: [] };
  const [primary, ...alternatives] = eligible;
  return { primary, alternatives };
}
