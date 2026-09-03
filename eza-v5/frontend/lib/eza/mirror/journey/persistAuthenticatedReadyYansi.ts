/**
 * Phase 8.8G-4 — persist authenticated ready/unpublished Yansı to the server.
 *
 * Local artifacts remain a cache. Authenticated READY_UNPUBLISHED authority is the server.
 * Guest paths must not call this.
 */

import { isPersistableConversationSceneUrl } from '@/lib/eza/conversationSceneIdentity';
import {
  getServerConversationAuthority,
  getServerIdForClientChat,
  isServerConversationAuthorityValid,
  noteServerYansiReady,
} from '@/lib/eza/serverConversationStore';
import {
  putServerYansiPreparation,
  type ServerYansiPreparation,
} from '@/lib/eza/standaloneConversationsApi';
import type { MirrorJourneyArtifact } from '@/lib/eza/mirror/journey/mirrorJourneyArtifact';
import { isPublishableJourneyGenerationLineage } from '@/lib/eza/mirror/journey/journeyGenerationLineage';

export type PersistYansiPreparationAuthority = {
  ownerUserId: string;
  epoch: number;
};

export function captureYansiPreparationAuthority(
  ownerUserId: string | null | undefined
): PersistYansiPreparationAuthority | null {
  const owner = (ownerUserId || '').trim();
  if (!owner) return null;
  const auth = getServerConversationAuthority();
  if (auth.ownerKey !== owner) return null;
  return { ownerUserId: owner, epoch: auth.epoch };
}

export function isYansiPreparationAuthorityCurrent(
  bound: PersistYansiPreparationAuthority | null | undefined,
  ownerNow: string | null | undefined
): boolean {
  if (!bound) return false;
  const owner = (ownerNow || '').trim();
  if (!owner || owner !== bound.ownerUserId) return false;
  return isServerConversationAuthorityValid(bound.ownerUserId, bound.epoch);
}

function sceneUrlIsDurable(url: string | null | undefined): boolean {
  const value = (url || '').trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower.startsWith('blob:') || lower.startsWith('data:') || lower.startsWith('file:')) {
    return false;
  }
  if (value.startsWith('/api/public/mirror-scene-assets/')) return true;
  return isPersistableConversationSceneUrl(value);
}

export async function persistAuthenticatedReadyYansi(input: {
  artifact: MirrorJourneyArtifact;
  clientConversationId: string;
  bound: PersistYansiPreparationAuthority | null;
  ownerNow: string | null | undefined;
  sceneFocalX?: number | null;
  sceneFocalY?: number | null;
}): Promise<ServerYansiPreparation | null> {
  if (!isYansiPreparationAuthorityCurrent(input.bound, input.ownerNow)) {
    return null;
  }
  const lineage = input.artifact.sealedLineage;
  if (!lineage || !isPublishableJourneyGenerationLineage(lineage)) return null;
  const scene = (input.artifact.sceneImageUrl || '').trim();
  if (!sceneUrlIsDurable(scene)) return null;
  const title =
    input.artifact.publicTitle?.trim() ||
    input.artifact.sealedPublicLanding?.publicTitle?.trim() ||
    '';
  const summary =
    input.artifact.publicSummary?.trim() ||
    input.artifact.sealedPublicLanding?.publicSummary?.trim() ||
    '';
  if (!title || !summary) return null;

  const serverId = getServerIdForClientChat(input.clientConversationId);
  if (!serverId) return null;

  const result = await putServerYansiPreparation(serverId, {
    journeyId: lineage.journeyId,
    journeyVersion: lineage.journeyVersion,
    windowIndex: lineage.windowIndex,
    windowHash: lineage.windowHash,
    selectedStepsHash: lineage.selectedStepsHash,
    sourceBlockHash: lineage.sourceBlockHash ?? null,
    generationId: lineage.generationId,
    publicTitle: title,
    publicSummary: summary,
    continuationContext: input.artifact.continuationContext ?? null,
    sceneImageUrl: scene,
    sceneAssetId: input.artifact.sceneAssetId ?? lineage.sceneAssetId ?? null,
    sceneFocalX: input.sceneFocalX ?? null,
    sceneFocalY: input.sceneFocalY ?? null,
    sealedLineage: lineage as unknown as Record<string, unknown>,
    sealedPublicLanding: input.artifact.sealedPublicLanding
      ? (input.artifact.sealedPublicLanding as unknown as Record<string, unknown>)
      : null,
  });

  const ownerAfter = getServerConversationAuthority().ownerKey;
  if (!isYansiPreparationAuthorityCurrent(input.bound, ownerAfter)) {
    return null;
  }
  noteServerYansiReady(input.clientConversationId);
  return result;
}
