/**
 * Phase 5.1 / 5.1.1 — published child Yansı continuation helpers.
 * /children is the eligibility authority; /frozen supplies replay content.
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
  /** First eligible child in deterministic server order. */
  primary: EligibleChildContinuation | null;
  /** Remaining eligible siblings (same order). */
  alternatives: EligibleChildContinuation[];
  /**
   * Eligible/public frozen continuation count from /children `total`
   * (not raw DB children; not impact yansiCount).
   */
  eligibleCount: number;
  /** Listed children that failed /frozen defense-in-depth probe. */
  skippedCount: number;
};

/**
 * Primary = first eligible by server /children order.
 * Alternatives = remaining eligible siblings.
 * Lazy: hydrate frozen artifacts for listed items only (no descendant recursion).
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
    eligibleCount: 0,
    skippedCount: 0,
  };
  if (!slug) return empty;

  const listed = await fetchPublishedChildren(slug);
  if (!listed.ok) return empty;

  const eligibleCount =
    typeof listed.data.total === 'number' ? listed.data.total : listed.data.items.length;
  const candidates = listed.data.items.slice(0, maxProbe);
  const eligible: EligibleChildContinuation[] = [];
  let skipped = 0;

  for (const meta of candidates) {
    // Defense-in-depth: server already filters; still require /frozen body for replay.
    const artifact = await fetchPublicFrozenJourneyArtifact({ slug: meta.slug });
    if (!artifact) {
      skipped += 1;
      continue;
    }
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
    eligibleCount,
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
