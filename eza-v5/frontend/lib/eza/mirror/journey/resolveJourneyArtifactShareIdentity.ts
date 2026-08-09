/**
 * Phase 3.7.5 — resolve share/publish identity for a specific Journey artifact.
 * Never falls back to a different Journey's conversation cache for Journey V1.
 */

import { loadMirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  readMirrorShareLink,
  readMirrorShareLinkForJourney,
  type MirrorJourneyShareLinkRecord,
  type MirrorShareLinkRecord,
} from '@/lib/eza/mirror-share/mirrorShareLinkCache';

export type JourneyArtifactShareIdentity = {
  journeyId: string;
  journeyVersion: number;
  slug: string;
  shareUrl: string;
  publishedAt?: string | null;
  publicTitle?: string | null;
  publicSummary?: string | null;
  sceneImageUrl?: string | null;
  source: 'panel_artifact' | 'journey_share_cache' | 'conversation_legacy';
};

export function resolveJourneyArtifactShareIdentity(input: {
  ownerUserId: string | null | undefined;
  journeyId: string;
  journeyVersion: number;
  /** Only used for legacy non-journey fallback when artifact missing. */
  conversationId?: string | null;
  allowConversationLegacyFallback?: boolean;
}): JourneyArtifactShareIdentity | null {
  const artifact = loadMirrorJourneyArtifact(
    input.ownerUserId,
    input.journeyId,
    input.journeyVersion
  );
  if (artifact?.publish.slug && artifact.publish.shareUrl) {
    return {
      journeyId: artifact.journeyId,
      journeyVersion: artifact.journeyVersion,
      slug: artifact.publish.slug,
      shareUrl: artifact.publish.shareUrl,
      publishedAt: artifact.publish.publishedAt,
      publicTitle: artifact.publicTitle,
      publicSummary: artifact.publicSummary,
      sceneImageUrl: artifact.sceneImageUrl,
      source: 'panel_artifact',
    };
  }

  const journeyShare = readMirrorShareLinkForJourney(
    input.ownerUserId,
    input.journeyId,
    input.journeyVersion
  );
  if (journeyShare) {
    return {
      journeyId: journeyShare.journeyId,
      journeyVersion: journeyShare.journeyVersion,
      slug: journeyShare.slug,
      shareUrl: journeyShare.shareUrl,
      publishedAt: journeyShare.publishedAt,
      publicTitle: journeyShare.publicTitle,
      publicSummary: journeyShare.publicSummary,
      sceneImageUrl: artifact?.sceneImageUrl ?? null,
      source: 'journey_share_cache',
    };
  }

  if (input.allowConversationLegacyFallback && input.conversationId) {
    const legacy = readMirrorShareLink(input.conversationId, input.ownerUserId);
    if (legacy) {
      return {
        journeyId: input.journeyId.trim().toLowerCase(),
        journeyVersion: input.journeyVersion,
        slug: legacy.slug,
        shareUrl: legacy.shareUrl,
        publishedAt: legacy.updatedAt,
        publicTitle: legacy.publicTitle,
        publicSummary: legacy.publicSummary,
        sceneImageUrl: null,
        source: 'conversation_legacy',
      };
    }
  }

  return null;
}

export function previewFieldsFromArtifact(
  artifact: MirrorJourneyArtifact
): {
  publicTitle: string | null;
  publicSummary: string | null;
  continuationContext: string | null;
  sceneImageUrl: string | null;
  sceneAssetId: string | null;
} {
  return {
    publicTitle: artifact.publicTitle ?? null,
    publicSummary: artifact.publicSummary ?? null,
    continuationContext: artifact.continuationContext ?? null,
    sceneImageUrl: artifact.sceneImageUrl ?? null,
    sceneAssetId: artifact.sceneAssetId ?? null,
  };
}

export type { MirrorJourneyShareLinkRecord, MirrorShareLinkRecord };
