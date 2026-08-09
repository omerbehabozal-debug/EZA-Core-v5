/**
 * Complete Phase 3.6 lineage seal after D2 curiosity + scene are known.
 */

import type { DailyMirrorCardModel } from '@/lib/eza/mirror/types';
import { isMirrorInterpretationV1 } from '@/lib/eza/mirror/mirrorInterpretationTypes';
import { interpretationHash, mappedPromptHash } from '@/lib/eza/mirror/mirrorLineageHash';
import { hashPublicMirrorLanding } from '@/lib/eza/mirror-network/publicMirrorLanding';
import {
  isPublishableJourneyGenerationLineage,
  sealJourneyGenerationLineage,
  type JourneyGenerationLineage,
  type JourneyGenerationLineagePartial,
} from '@/lib/eza/mirror/journey/journeyGenerationLineage';
import { saveJourneyGenerationArtifact } from '@/lib/eza/mirror/journey/journeyGenerationArtifactStore';
import { markMirrorJourneyArtifactReadyFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';

function sceneAssetIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/mirror-scene-assets\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function persistReadyPanelArtifact(
  ownerUserId: string | null | undefined,
  lineage: JourneyGenerationLineage,
  card: DailyMirrorCardModel,
  sceneImageUrl?: string | null
): void {
  const landing = card.mirrorV3Payload?.curiosityBundle?.publicLanding;
  markMirrorJourneyArtifactReadyFromLineage(ownerUserId, {
    lineage,
    sceneImageUrl: sceneImageUrl || null,
    publicTitle: landing?.publicTitle ?? null,
    publicSummary: landing?.publicSummary ?? null,
    continuationContext: landing?.continuationContext ?? null,
  });
}

export async function completeJourneyGenerationLineageSeal(input: {
  card: DailyMirrorCardModel;
  sceneImageUrl?: string | null;
  generationId?: string | null;
  ownerUserId?: string | null;
}): Promise<DailyMirrorCardModel> {
  const existing = input.card.mirrorJourneyGenerationLineage;
  if (!existing || typeof existing !== 'object') {
    return input.card;
  }
  // Already fully sealed for this generation — keep immutable.
  if (
    isPublishableJourneyGenerationLineage(existing) &&
    (!input.generationId ||
      existing.generationId === input.generationId.trim()) &&
    (!input.sceneImageUrl ||
      existing.sceneAssetId ||
      !sceneAssetIdFromUrl(input.sceneImageUrl))
  ) {
    // Still refresh sceneAssetId if missing.
    if (
      isPublishableJourneyGenerationLineage(existing) &&
      !existing.sceneAssetId &&
      input.sceneImageUrl
    ) {
      const withScene: JourneyGenerationLineage = {
        ...existing,
        sceneAssetId: sceneAssetIdFromUrl(input.sceneImageUrl),
      };
      saveJourneyGenerationArtifact(input.ownerUserId, withScene);
      persistReadyPanelArtifact(
        input.ownerUserId,
        withScene,
        input.card,
        input.sceneImageUrl
      );
      return { ...input.card, mirrorJourneyGenerationLineage: withScene };
    }
    if (isPublishableJourneyGenerationLineage(existing)) {
      saveJourneyGenerationArtifact(input.ownerUserId, existing);
      persistReadyPanelArtifact(
        input.ownerUserId,
        existing,
        input.card,
        input.sceneImageUrl
      );
    }
    return input.card;
  }

  const landing =
    input.card.mirrorV3Payload?.curiosityBundle?.publicLanding ?? null;
  const anchors = landing?.semanticAnchors;
  const publicLandingHash = landing
    ? await hashPublicMirrorLanding(landing)
    : '';
  const interpHash =
    (typeof existing.interpretationHash === 'string' &&
      existing.interpretationHash.trim()) ||
    (isMirrorInterpretationV1(input.card.mirrorFinalInterpretation)
      ? await interpretationHash(input.card.mirrorFinalInterpretation)
      : '');
  const mappedHash =
    (typeof existing.mappedPromptHash === 'string' &&
      existing.mappedPromptHash.trim()) ||
    (input.card.visual?.prompt
      ? await mappedPromptHash(input.card.visual.prompt)
      : '');

  const sealedPartial: JourneyGenerationLineagePartial = sealJourneyGenerationLineage({
    existing,
    interpretationHash: interpHash,
    anchorsHash: anchors?.anchorsHash ?? existing.anchorsHash ?? null,
    publicLandingHash,
    mappedPromptHash: mappedHash,
    generationId: input.generationId || existing.generationId,
    sceneAssetId:
      sceneAssetIdFromUrl(input.sceneImageUrl) || existing.sceneAssetId || null,
  });

  if (!isPublishableJourneyGenerationLineage(sealedPartial)) {
    return {
      ...input.card,
      mirrorJourneyGenerationLineage: sealedPartial,
    };
  }

  saveJourneyGenerationArtifact(input.ownerUserId, sealedPartial);
  persistReadyPanelArtifact(
    input.ownerUserId,
    sealedPartial,
    input.card,
    input.sceneImageUrl
  );
  return {
    ...input.card,
    mirrorJourneyGenerationLineage: sealedPartial,
  };
}
