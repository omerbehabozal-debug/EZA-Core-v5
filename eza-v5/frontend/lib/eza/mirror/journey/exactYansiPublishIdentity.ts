/**
 * Exact-artifact Yansı publish identity.
 *
 * Capture BEFORE the first async publish await. Never resolve "latest READY"
 * for an artifact-specific publish — wrong mutation is worse than delayed UI.
 */

import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import {
  isPublishableJourneyGenerationLineage,
  type JourneyGenerationLineage,
} from './journeyGenerationLineage';
import { findReusablePreparedYansiArtifact } from './resolveConversationYansiStatus';

export type ExactYansiPublishIdentity = {
  journeyId: string;
  journeyVersion: number;
  generationId: string;
  windowIndex: number;
  windowStart: number;
  windowEnd: number;
  parentJourneyId: string | null;
  sourceConversationId: string;
  sceneImageUrl: string | null;
  publicTitle: string | null;
  publicSummary: string | null;
  /** Sealed lineage reference — selectedSteps / hashes live here. */
  sealedLineage: JourneyGenerationLineage;
};

function normalizeId(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Capture immutable publish target from the selected Ayna reel artifact.
 * Fail closed when sealed lineage is missing or incomplete.
 */
export function captureExactYansiPublishIdentity(
  artifact: MirrorJourneyArtifact
): ExactYansiPublishIdentity | null {
  const sealed = artifact.sealedLineage;
  if (!isPublishableJourneyGenerationLineage(sealed)) return null;

  const journeyId = normalizeId(sealed.journeyId) || normalizeId(artifact.journeyId);
  if (!journeyId) return null;
  if (normalizeId(artifact.journeyId) && normalizeId(artifact.journeyId) !== journeyId) {
    return null;
  }
  if (artifact.journeyVersion !== sealed.journeyVersion) {
    return null;
  }

  return {
    journeyId,
    journeyVersion: sealed.journeyVersion,
    generationId: sealed.generationId,
    windowIndex: sealed.windowIndex,
    windowStart: sealed.windowStart,
    windowEnd: sealed.windowEnd,
    parentJourneyId: sealed.parentJourneyId?.trim().toLowerCase() || null,
    sourceConversationId: sealed.sourceConversationId.trim(),
    sceneImageUrl: artifact.sceneImageUrl?.trim() || null,
    publicTitle:
      artifact.publicTitle?.trim() ||
      artifact.sealedPublicLanding?.publicTitle?.trim() ||
      null,
    publicSummary:
      artifact.publicSummary?.trim() ||
      artifact.sealedPublicLanding?.publicSummary?.trim() ||
      null,
    sealedLineage: sealed,
  };
}

export function exactIdentityMatchesCardLineage(
  exact: ExactYansiPublishIdentity,
  cardLineage: unknown
): boolean {
  if (!isPublishableJourneyGenerationLineage(cardLineage)) return false;
  return (
    normalizeId(cardLineage.journeyId) === exact.journeyId &&
    cardLineage.journeyVersion === exact.journeyVersion
  );
}

/**
 * After a successful network publish, resolve which local artifact may be marked.
 *
 * - Prefer sealed lineage on the published card when it matches exact (if given).
 * - Else require exact journeyId to look up a reusable artifact.
 * - Never pick "latest READY" without journeyId.
 */
export function resolvePostPublishArtifactMarkTarget(input: {
  cardLineage: unknown;
  exact?: ExactYansiPublishIdentity | null;
  conversationArtifacts: MirrorJourneyArtifact[];
}): { journeyId: string; journeyVersion: number } | null {
  const exact = input.exact ?? null;
  const lineage = input.cardLineage;

  if (isPublishableJourneyGenerationLineage(lineage)) {
    const lineageId = normalizeId(lineage.journeyId);
    if (exact && lineageId !== exact.journeyId) {
      return null;
    }
    if (exact && lineage.journeyVersion !== exact.journeyVersion) {
      return null;
    }
    return {
      journeyId: lineageId,
      journeyVersion: lineage.journeyVersion,
    };
  }

  if (!exact) {
    // Legacy / non-exact path: caller may still use unscoped reuse deliberately.
    // Artifact-specific publish must always pass `exact`.
    return null;
  }

  const ready = findReusablePreparedYansiArtifact(input.conversationArtifacts, {
    journeyId: exact.journeyId,
  });
  if (!ready) return null;
  if (ready.journeyVersion !== exact.journeyVersion) {
    const versionMatch = input.conversationArtifacts.find(
      (row) =>
        normalizeId(row.journeyId) === exact.journeyId &&
        row.journeyVersion === exact.journeyVersion &&
        (row.status === 'ready' || row.status === 'published')
    );
    if (!versionMatch) return null;
    return {
      journeyId: normalizeId(versionMatch.journeyId),
      journeyVersion: versionMatch.journeyVersion,
    };
  }
  return {
    journeyId: normalizeId(ready.journeyId),
    journeyVersion: ready.journeyVersion,
  };
}
