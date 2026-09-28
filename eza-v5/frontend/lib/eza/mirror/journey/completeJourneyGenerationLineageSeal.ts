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
import {
  isSealedJourneySceneIdentity,
  journeySceneIdentityKey,
  loadMirrorJourneyArtifact,
  markMirrorJourneyArtifactReadyFromLineage,
  sealedJourneyIdentityConflicts,
} from '@/lib/eza/mirror/journey/mirrorJourneyArtifactStore';
import { buildReadyMirrorJourneyArtifactFromLineage } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import {
  canonicalMirrorSceneAssetId,
  canonicalMirrorSceneAssetIdFromUrl,
} from '@/lib/eza/mirror/sceneAssetIdentity';

function sealedArtifactRejectsIncomingScene(
  ownerUserId: string | null | undefined,
  lineage: JourneyGenerationLineage,
  sceneImageUrl?: string | null
): boolean {
  const existing = loadMirrorJourneyArtifact(
    ownerUserId,
    lineage.journeyId,
    lineage.journeyVersion
  );
  if (!existing) return false;
  const incoming = buildReadyMirrorJourneyArtifactFromLineage({
    lineage,
    sceneImageUrl,
    existing,
  });
  if (!incoming) return false;
  return sealedJourneyIdentityConflicts(existing, incoming);
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
    sealedPublicLanding: landing
      ? {
          publicTitle: landing.publicTitle,
          publicSummary: landing.publicSummary,
          continuationContext: landing.continuationContext,
          topicCategory: landing.topicCategory,
          semanticSource: landing.semanticSource,
          interpretationHash: landing.interpretationHash,
          publicLandingHash: landing.publicLandingHash,
          contractVersion: landing.contractVersion,
          semanticAnchors: landing.semanticAnchors
            ? (landing.semanticAnchors as unknown as Record<string, unknown>)
            : null,
        }
      : null,
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
  const storedJourneyId =
    typeof existing.journeyId === 'string' ? existing.journeyId : '';
  const storedVersion =
    typeof existing.journeyVersion === 'number' && existing.journeyVersion >= 1
      ? existing.journeyVersion
      : 1;
  if (storedJourneyId && input.ownerUserId) {
    const stored = loadMirrorJourneyArtifact(
      input.ownerUserId,
      storedJourneyId,
      storedVersion
    );
    if (stored && isSealedJourneySceneIdentity(stored)) {
      const incomingGeneration = (input.generationId || existing.generationId || '')
        .toString()
        .trim();
      if (incomingGeneration && incomingGeneration !== stored.generationId.trim()) {
        return input.card;
      }
      const incomingScene = journeySceneIdentityKey(input.sceneImageUrl, null);
      const sealedScene = journeySceneIdentityKey(
        stored.sceneImageUrl,
        stored.sceneAssetId
      );
      if (incomingScene && sealedScene && incomingScene !== sealedScene) {
        return input.card;
      }
      if (
        isPublishableJourneyGenerationLineage(existing) &&
        sealedArtifactRejectsIncomingScene(
          input.ownerUserId,
          existing,
          input.sceneImageUrl
        )
      ) {
        return input.card;
      }
    }
  }
  // Already fully sealed for this generation — keep immutable.
  if (
    isPublishableJourneyGenerationLineage(existing) &&
    (!input.generationId ||
      existing.generationId === input.generationId.trim()) &&
    (!input.sceneImageUrl ||
      canonicalMirrorSceneAssetId(existing.sceneAssetId) ||
      !canonicalMirrorSceneAssetIdFromUrl(input.sceneImageUrl))
  ) {
    const existingSceneAsset = canonicalMirrorSceneAssetId(existing.sceneAssetId);
    const inputSceneAsset = canonicalMirrorSceneAssetIdFromUrl(input.sceneImageUrl);
    if (inputSceneAsset && existingSceneAsset && inputSceneAsset !== existingSceneAsset) {
      return input.card;
    }
    if (existingSceneAsset && existing.sceneAssetId !== existingSceneAsset) {
      const withCanonicalScene: JourneyGenerationLineage = {
        ...existing,
        sceneAssetId: existingSceneAsset,
      };
      saveJourneyGenerationArtifact(input.ownerUserId, withCanonicalScene);
      persistReadyPanelArtifact(
        input.ownerUserId,
        withCanonicalScene,
        input.card,
        input.sceneImageUrl
      );
      return { ...input.card, mirrorJourneyGenerationLineage: withCanonicalScene };
    }
    // Still refresh sceneAssetId if missing.
    if (
      isPublishableJourneyGenerationLineage(existing) &&
      !canonicalMirrorSceneAssetId(existing.sceneAssetId) &&
      input.sceneImageUrl
    ) {
      const withScene: JourneyGenerationLineage = {
        ...existing,
        sceneAssetId: canonicalMirrorSceneAssetIdFromUrl(input.sceneImageUrl),
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
      canonicalMirrorSceneAssetIdFromUrl(input.sceneImageUrl) ||
      canonicalMirrorSceneAssetId(existing.sceneAssetId) ||
      null,
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
