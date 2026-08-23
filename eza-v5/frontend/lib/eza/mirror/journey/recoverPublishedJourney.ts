/**
 * Phase 8.6 — recover canonical published state after lost publish response.
 *
 * Server published/frozen is authority. Local ready/generating must upgrade
 * when durable publish already exists for the same journey identity.
 */

import type { MirrorJourneyArtifact } from './mirrorJourneyArtifact';
import {
  hydratePublishedJourneysFromServer,
  type OwnerPublishedJourneyServerItem,
} from './hydratePublishedJourneysFromServer';
import {
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactPublished,
} from './mirrorJourneyArtifactStore';
import { hydrateOwnerYansiPublicationAuthority } from './ownerYansiPublicationAuthority';

export type RecoverPublishedJourneyResult = {
  recovered: boolean;
  item: OwnerPublishedJourneyServerItem | null;
  artifact: MirrorJourneyArtifact | null;
};

export async function recoverPublishedJourneyAfterLostResponse(input: {
  ownerUserId: string;
  conversationId: string;
  journeyId: string;
  journeyVersion: number;
}): Promise<RecoverPublishedJourneyResult> {
  const owner = input.ownerUserId.trim();
  const conversationId = input.conversationId.trim();
  const journeyId = input.journeyId.trim().toLowerCase();
  const journeyVersion = Number(input.journeyVersion) || 1;
  if (!owner || !conversationId || !journeyId) {
    return { recovered: false, item: null, artifact: null };
  }

  const items = await hydratePublishedJourneysFromServer({
    ownerUserId: owner,
    conversationId,
  });
  const item =
    items.find(
      (row) =>
        (row.journeyId || row.slug || '').trim().toLowerCase() === journeyId &&
        (Number(row.journeyVersion) || 1) === journeyVersion
    ) || null;

  if (!item?.slug) {
    return { recovered: false, item: null, artifact: null };
  }

  const shareUrl = `/m/${item.slug}`;
  markMirrorJourneyArtifactPublished(owner, {
    journeyId,
    journeyVersion,
    slug: item.slug,
    shareUrl,
    publicTitle: item.publicTitle,
    publicSummary: item.publicSummary,
    continuationContext: item.continuationContext,
    sceneImageUrl: item.sceneImageUrl,
  });

  const artifact = loadMirrorJourneyArtifact(owner, journeyId, journeyVersion);
  if (artifact?.status === 'published') {
    // Visibility lives on owner profile, not the frozen-journeys list.
    await hydrateOwnerYansiPublicationAuthority();
  }
  return {
    recovered: Boolean(artifact?.status === 'published'),
    item,
    artifact,
  };
}
